import { PlusOutlined, ApiOutlined } from '@ant-design/icons';
import { Button, Empty, FormInstance, Input, InputNumber, Select, Tooltip } from 'antd';
import React from 'react';
import { LM } from 'src/translations/language-manager';
import { BasePanel } from '../BasePanel';
import { Form } from "antd";
import './ProfilePanel.scss';
import Password from 'antd/lib/input/Password';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { FileSelect } from 'src/common/FileSelect/FileSelect';
import { FixVersion, ProfileWithCredentials } from 'src/services/profile/ProfileDefs';
import { Subscription } from 'rxjs';
import { NavigationPathAction } from 'src/services/navigation/NevigationService';
import { ProfileInstance } from './ProfileInstance';
import { deepCopyObject } from 'src/utils/utils';

const { Option } = Select;
interface ProfilePanelState {
    showNewForm: boolean;
    isNewForm: boolean,
    profiles: ProfileWithCredentials[];
    currentProfile: ProfileWithCredentials | undefined;
    requireTransportDic: boolean;
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`profile_management.${msg}`);
}

export class ProfilePanel extends React.Component<any, ProfilePanelState> {
    private formRef = React.createRef<FormInstance>();
    private navSubscription?: Subscription;
    private profilesSubscription?: Subscription;
    private profileSaveSubscription?: Subscription;

    constructor(props: any) {
        super(props);

        this.state = {
            showNewForm: false,
            profiles: GlobalServiceRegistry.profile.getAllProfiles(),
            currentProfile: undefined,
            isNewForm: true,
            requireTransportDic: false
        }
    }

    componentDidMount() {
        const { profile } = GlobalServiceRegistry;
        this.profilesSubscription = profile.getProfileUpdateObservable().subscribe(() => {
            this.setState({ profiles: profile.getAllProfiles() })
        })

        this.subscribeToNavigations();
    }

    componentWillUnmount() {
        this.navSubscription?.unsubscribe();
        this.profilesSubscription?.unsubscribe();
        this.profileSaveSubscription?.unsubscribe()
    }

    private subscribeToNavigations = () => {
        const { navigation } = GlobalServiceRegistry;
        this.navSubscription = navigation.getNavigationEventObservable().subscribe(event => {
            const pathPart = navigation.getNavigationInfoIfApplicable(event.path, "profile");
            if (pathPart) {
                if (pathPart.action) {
                    this.performNavAction(pathPart.action);
                }
                navigation.propergate(event);
            }
        });
    }

    private performNavAction = (actionObj: NavigationPathAction) => {
        const { action, id } = actionObj;
        switch (action) {
            case "open":
                id && this.setState({ showNewForm: true })
                break;
        }
    }

    private onSubmitNewProfile = (data: any) => {
        GlobalServiceRegistry.profile.addOrEditProfile(data);
        this.onCloseNewPanel();
    }

    private onCloseNewPanel = () => {
        this.setState({ showNewForm: false })
    }

    private getNewProfileForm = () => {
        const { showNewForm, currentProfile, isNewForm, requireTransportDic } = this.state;
        return <div className={`new-profile-form-wrapper-${showNewForm ? "open" : "close"}`}>
            {showNewForm && <div className="profile-management-wrapper">
                <div className="title"><ApiOutlined />{getIntlMessage(isNewForm ? "new_profile_title" : "edit_profile_title")}</div>
                <Form ref={this.formRef} layout="vertical" className="new-profile-form" autoComplete={"off"}
                    onFinish={this.onSubmitNewProfile} initialValues={currentProfile ?? undefined} onValuesChange={(val) => {
                        val["fixVersion"] && this.setState({ requireTransportDic: val["fixVersion"] === FixVersion.FIX_5 })
                    }}>
                    <Form.Item name="name" label={getIntlMessage("name")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="ip" label={getIntlMessage("ip")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="port" label={getIntlMessage("port")} rules={[{ required: true }]}>
                        <InputNumber />
                    </Form.Item>
                    <Form.Item name="hbInterval" label={getIntlMessage("hb_interval")}>
                        <InputNumber />
                    </Form.Item>
                    <Form.Item name="senderCompId" label={getIntlMessage("sender_comp_id")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label={getIntlMessage("password")} rules={[{ required: true }]}>
                        <Password />
                    </Form.Item>
                    <Form.Item name="targetCompId" label={getIntlMessage("target_comp_id")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="fixVersion" label={getIntlMessage("fix_version_selector")} rules={[{ required: true }]}>
                        <Select >
                            <Option value={FixVersion.FIX_4}>{FixVersion.FIX_4}</Option>
                            <Option value={FixVersion.FIX_5}>{FixVersion.FIX_5}</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="dictionaryLocation" label={getIntlMessage("dictionary_location")} rules={[{ required: true }]}>
                        <FileSelect label={"Browse"} />
                    </Form.Item>
                    {requireTransportDic && <Form.Item name="transportDictionaryLocation" label={getIntlMessage("transport_dictionary_location")} rules={[{ required: true }]}>
                        <FileSelect label={"Browse"} />
                    </Form.Item>}
                    <div className="footer">
                        <Button type="ghost" onClick={this.onCloseNewPanel}>{getIntlMessage("cancel")}</Button>
                        <Button type="primary" htmlType="submit">{getIntlMessage("save")}</Button>
                    </div>
                </Form>
            </div>}
        </div>
    }

    private onNewProfile = () => {
        this.setState({ showNewForm: true, isNewForm: true })
    }

    private onCopy = (profile: ProfileWithCredentials) => {
        const currentProfile = deepCopyObject(profile);
        currentProfile["name"] = currentProfile["name"] + "__copy";
        this.setState({ showNewForm: true, currentProfile, isNewForm: true })
    }

    private onEdit = (profile: ProfileWithCredentials) => {
        this.setState({ showNewForm: true, currentProfile: profile, isNewForm: false })
    }

    private getAllProfilesView = () => {
        const { profiles } = this.state;

        return <div className="all-profile-wrapper">
            {profiles.map((profile, i) => <ProfileInstance onCopy={this.onCopy} onEdit={this.onEdit} profile={profile} key={i} />)}
            {profiles.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={getIntlMessage("no_profiles")} />}
        </div >
    }

    render() {
        return <BasePanel className="profile-management" title={<React.Fragment>{getIntlMessage("title")}
            <Tooltip placement="right" title={getIntlMessage("new_profile")}>
                <Button shape="circle" icon={<PlusOutlined />} onClick={this.onNewProfile} />
            </Tooltip>
        </React.Fragment>}>
            {this.getNewProfileForm()}
            {this.getAllProfilesView()}
        </BasePanel>
    }
}
