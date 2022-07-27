
import React, { useRef } from 'react';
import { Subscription } from 'rxjs';
import { FixSession, FixSessionEventType, } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import { Scenario } from './ScenarioDefs';
import './Scenarios.scss';
import { Button, Collapse, Popover, Form, Input, Menu, Dropdown } from 'antd';
import { ScenarioInstance } from './ScenarioInstance';
import { PlusOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
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
    session: FixSession;
}

interface ScenariosState {
    connected: boolean,
    addScenarioVisible: boolean
}

export class Scenarios extends React.Component<ScenariosProps, ScenariosState> {
    private updateSub?: Subscription;
    private sessionSub?: Subscription;
    private scenarios = new Map<string, { scenario: Scenario, sub: Subscription }>();

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
    }

    private removeScenario = (name: string) => {
        this.scenarios.get(name)?.sub.unsubscribe();
        this.scenarios.delete(name);
        this.forceUpdate();
    }

    private genExtraHeader = (inst: Scenario) => {
        return <div className="scenario-extra-header">
            <Button className="play-btn" icon={<SendOutlined />}
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
            <Menu.Item key="1" onClick={() => {
                GlobalServiceRegistry.scenarioManager.saveScenario(this.props.session.getProfile(), inst).then(() => {
                    Toast.success(getIntlMessage("msg_saving_success_title"), getIntlMessage("msg_saving_success", { name: inst.name }))
                }).catch(err => {
                    Toast.error(getIntlMessage("msg_saving_failed_title"), getIntlMessage("msg_saving_failed"))
                })
            }}>{getIntlMessage("save")}</Menu.Item>
            <Menu.Item key="2"
                onClick={() => {
                    this.removeScenario(inst.name)
                }}>{getIntlMessage("delete")}</Menu.Item>
        </Menu>
    }


    render() {
        const { session } = this.props;
        const { addScenarioVisible } = this.state;
        const scenarios = Array.from(this.scenarios.values()).map(({ scenario }) => scenario);

        return <div className="scenarios-wrapper">
            <div className="header">
                {getIntlMessage("title")}
                <div className="add-btn">
                    <Popover
                        content={<AddScenarioForm togglePopover={this.togglePopover} onAdded={(data) => { this.onAddNewScenario(data.name) }} />}
                        title={getIntlMessage("add_new_scenario").toUpperCase()}
                        placement="top"
                        visible={addScenarioVisible}
                    >
                        <Button type="ghost" icon={<PlusOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add_new_scenario")}</Button>
                    </Popover>
                </div>
            </div>
            <div className="body">

                <Collapse>
                    {scenarios.map(inst => <Panel header={inst.name} key={inst.name} extra={this.genExtraHeader(inst)}>
                        <ScenarioInstance session={session} scenario={inst} />
                    </Panel >)}
                </Collapse>
            </div>
        </div>
    }
}


