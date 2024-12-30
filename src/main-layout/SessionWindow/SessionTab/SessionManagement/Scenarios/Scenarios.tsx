
import React, { useRef } from 'react';
import { Subscription } from 'rxjs';
import { BaseClientFixSession, FixSession, FixSessionEventType, } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import { Scenario } from './ScenarioDefs';
import './Scenarios.scss';
import { Button, Collapse, Popover, Form, Input, Menu, Dropdown } from 'antd';
import { ScenarioInstance } from './ScenarioInstance';
import { DownloadOutlined, PlusOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import { Toast } from 'src/common/Toast/Toast';

const { Panel } = Collapse;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`scenarios.${msg}`, options);
}

const AddScenarioForm = ({ togglePopover, onAdded }: {
    togglePopover: (state: boolean) => void,
    onAdded: (data: any) => void,
}) => {
    const formRef: any = useRef(null);

    const checkFormHasErrors = (): boolean => {
        const fields = formRef.current?.getFieldsError() ?? [];

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.errors.length > 0) {
                return true;
            }
        }

        return false;
    }

    return (<div className="add-new-form-container">
        <div className="header">
            <div className="close" onClick={() => togglePopover(false)}>✕</div>
        </div>
        <Form ref={formRef} layout="vertical" className="add-new-form"
            onFinish={(values) => {
                onAdded(values);
                formRef.current?.resetFields();
            }}>
            <div className="form-item-container">
                <Form.Item name="name" rules={[{
                    required: true,
                }]} label={getIntlMessage("name")}>
                    <Input />
                </Form.Item>
            </div>
            <div style={{ textAlign: "center" }}>
                <Button className="button-v2" type="primary" style={{ marginLeft: "auto" }}
                    htmlType="submit" onClick={() => {
                        setTimeout(() => {
                            if (!checkFormHasErrors()) {
                                togglePopover(false)
                            }
                        }, 10)
                    }}>
                    {getIntlMessage("add").toUpperCase()}
                </Button>
            </div>
        </Form>
    </div>);
}

interface ScenariosProps {
    session: BaseClientFixSession;
}

interface ScenariosState {
    connected: boolean,
    addScenarioVisible: boolean
}

export class Scenarios extends React.Component<ScenariosProps, ScenariosState> {
    private updateSub?: Subscription;
    private sessionSub?: Subscription;
    private scenarios = new Map<string, { scenario: Scenario, sub: Subscription }>();
    private fileManager = GlobalServiceRegistry.fileManger;

    constructor(props: any) {
        super(props)
        this.state = {
            addScenarioVisible: false,
            connected: this.props.session.isReady()
        }

    }

    componentDidMount() {
        this.fetchScenarios();

        this.updateSub = GlobalServiceRegistry.favoriteManager.getFavoriteUpdateObservable().subscribe(() => {
            this.forceUpdate();
            this.fetchScenarios();
        })

        this.subscribeSession();
    }

    componentDidUpdate(prevProps: Readonly<ScenariosProps>, prevState: Readonly<ScenariosState>, snapshot?: any): void {
        if (prevProps.session !== this.props.session) {
            this.subscribeSession()
        }
    }

    private subscribeSession() {
        this.sessionSub?.unsubscribe();
        this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
            this.forceUpdate();
            this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT })
        })
    }

    componentWillUnmount() {
        this.updateSub?.unsubscribe();
        this.sessionSub?.unsubscribe();
        this.scenarios.forEach(({ sub }) => sub.unsubscribe())
    }

    private fetchScenarios() {
        GlobalServiceRegistry.scenarioManager.getAllScenarios(this.props.session).then(scenarios => {
            scenarios.forEach(scenario => {
                this.scenarios.set(scenario.name, { scenario, sub: scenario.getStageUpdateObservable().subscribe(() => this.forceUpdate()) })
            })

            this.forceUpdate();
        }).catch(error => {
            console.log("Failed to load favorites")
        })
    }

    private togglePopover = (state: boolean) => {
        this.setState({ addScenarioVisible: state })
    }

    private onAddNewScenario = (name: string) => {
        const scenario = new Scenario(name, this.props.session);
        this.scenarios.set(scenario.name, { scenario, sub: scenario.getStageUpdateObservable().subscribe(() => this.forceUpdate()) })
        this.forceUpdate();
        return scenario;
    }

    private saveScenario = (inst: Scenario) => {
        GlobalServiceRegistry.scenarioManager.saveScenario(this.props.session, inst).then(() => {
            Toast.success(getIntlMessage("msg_saving_success_title"), getIntlMessage("msg_saving_success", { name: inst.name }));
        }).catch(err => {
            console.error("Failed to save scenario", err);
            Toast.error(getIntlMessage("msg_saving_failed_title"), getIntlMessage("msg_saving_failed"));
        });
    }

    private removeScenario = (name: string) => {
        this.scenarios.get(name)?.sub.unsubscribe();
        this.scenarios.delete(name);
        this.forceUpdate();
    }

    private exportScenario = (inst: Scenario) => {
        this.fileManager.selectFile(["openDirectory"])
            .then(async (data) => {
                if (data?.path) {
                    await this.fileManager.writeFile(`${data.path}/${inst.name}.json`, JSON.stringify(inst.getDataToSave()));
                    Toast.success(getIntlMessage("msg_exporting_success_title"), getIntlMessage("msg_exporting_success", { name: inst.name }));
                }
            })
            .catch(err => {
                console.error("Failed to export scenario", err);
                Toast.error(getIntlMessage("msg_exporting_failed_title"), getIntlMessage("msg_exporting_failed"));
            })
    }

    private addScenarioViaImport(fileName: string, data: string, counter: number) {
        const deduplicatedName = counter ? `${fileName}_${counter}` : fileName;
        if (this.scenarios.has(deduplicatedName)) {
            this.addScenarioViaImport(fileName, data, ++counter);
        } else {
            const inst = this.onAddNewScenario(deduplicatedName);
            inst.loadFromFile(data);
            GlobalServiceRegistry.scenarioManager.saveScenario(this.props.session.getProfile() as any, inst);
        }
    }

    private importScenario = () => {
        this.fileManager.selectFile(['openFile'], [{ name: 'Scenario Files', extensions: ['json'] }])
            .then(async (data) => {
                if (data?.path) {
                    const filePath = data.path as string;
                    const inputFileData = await this.fileManager.readFile(`${filePath}`);
                    if (inputFileData.fileData) {
                        const fileName = filePath.split('\\').pop()!.split('/').pop()!.replace('.json', '');
                        this.addScenarioViaImport(fileName, inputFileData.fileData.data, 0);
                    }
                }
            })
            .catch(err => {
                console.error("Failed to import scenario", err);
                Toast.error(getIntlMessage("scenario_import_failed_title"), getIntlMessage("scenario_import_failed"));
            })
    }

    private genExtraHeader = (inst: Scenario) => {
        const { connected } = this.state;

        return <div className="scenario-extra-header">
            <Button className="play-btn" disabled={!connected} icon={<SendOutlined />}
                onClick={(e) => {
                    e.stopPropagation();
                    if (inst.getState() === "EXECUTING") {
                        inst.stop();
                        this.forceUpdate()
                        return;
                    }

                    inst.run().then(() => this.forceUpdate()).catch(err => {
                        if (err.isCanceled === true) {
                            return;
                        }

                        this.forceUpdate()
                    })
                }}>{inst.getState() !== "EXECUTING" ? getIntlMessage("run") : getIntlMessage("stop")}</Button>
            <Dropdown overlay={this.getMenu(inst)}>
                <SettingOutlined onClick={event => event.stopPropagation()} />
            </Dropdown>
        </div>
    }

    private getMenu = (inst: Scenario) => {
        return <Menu>
            <Menu.Item key="1" onClick={() => { this.saveScenario(inst) }}>{getIntlMessage("save")}</Menu.Item>
            <Menu.Item key="2" onClick={() => { this.removeScenario(inst.name) }}>{getIntlMessage("delete")}</Menu.Item>
            <Menu.Item key="3" onClick={() => { this.exportScenario(inst) }}>{getIntlMessage("export")}</Menu.Item>
        </Menu>
    }


    render() {
        const { session } = this.props;
        const { addScenarioVisible } = this.state;
        const scenarios = Array.from(this.scenarios.values()).map(({ scenario }) => scenario);

        return <div className="scenarios-wrapper">
            <div className="header">
                {getIntlMessage("title")}
                <div className="actions">
                    <Popover
                        content={<AddScenarioForm togglePopover={this.togglePopover} onAdded={(data) => { this.onAddNewScenario(data.name) }} />}
                        title={getIntlMessage("add_new_scenario").toUpperCase()}
                        placement="top"
                        visible={addScenarioVisible}
                    >
                        <Button type="ghost" icon={<PlusOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add_new_scenario")}</Button>
                    </Popover>

                    <Button type="ghost" icon={<DownloadOutlined />} onClick={() => { this.importScenario() }}>{getIntlMessage("import")}</Button>
                </div>
            </div>
            <div className="body">

                <Collapse>
                    {scenarios.map(inst => <Panel header={inst.name} key={inst.name} extra={this.genExtraHeader(inst)}>
                        <ScenarioInstance session={session as FixSession} scenario={inst} />
                    </Panel >)}
                </Collapse>
            </div>
        </div>
    }
}


