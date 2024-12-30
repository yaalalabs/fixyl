
import React, { useRef } from 'react';
import { Subscription } from 'rxjs';
import { FixSession, FixSessionEventType, } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { Scenario, Stage } from './ScenarioDefs';
import './ScenarioInstance.scss';
import { Button, Collapse, Popover, Form, Input, Tooltip, InputNumber, Checkbox, Dropdown, Menu } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { AddMsgModal } from './AddMsgModal';
import { FixComplexType } from 'src/services/fix/FixDefs';
import { AddFavoriteModal } from './AddFavoriteModal';
import {
    SortableContainer,
    SortableContainerProps,
    SortableElement,
    SortableHandle,
} from 'react-sortable-hoc';

const { Panel } = Collapse;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`scenarios.${msg}`, options);
}

const AddStageForm = ({ togglePopover, onAdded, value }: {
    togglePopover: (state: boolean) => void,
    onAdded: (data: any) => void,
    value?: any
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

    return (<div className="add-new-stage-container" onClick={e => e.stopPropagation()}>
        <div className="header">
            <div className="close" onClick={(e) => {
                togglePopover(false);
            }}>✕</div>
        </div>
        <Form initialValues={value} ref={formRef} layout="vertical" className="add-new-stage-form"
            onFinish={(values) => {
                onAdded(values)
                formRef.current?.resetFields();
            }}>
            <div className="form-item-container">
                <Form.Item name="name" rules={[{
                    required: true,
                }]} label={getIntlMessage("stage_name")}>
                    <Input />
                </Form.Item>
                <Form.Item name="waitTime" label={getIntlMessage("wait_time")}>
                    <InputNumber />
                </Form.Item>
                <Form.Item name="stageWaitTime" label={getIntlMessage("stage_wait_time")}>
                    <InputNumber />
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
                    {value ? getIntlMessage("save").toUpperCase() : getIntlMessage("add").toUpperCase()}
                </Button>
            </div>
        </Form>
    </div>);
}

const DragHandle = SortableHandle(() => <div className="column-sort-row-handle">::</div>);

const SortableItem = SortableElement<any>(({ stage }: {
    stage: Stage,
}) => (
    <div className="column-sort-row">
        <div className="column-sort-row-content-wrapper">
            <DragHandle />
            {stage.name}
        </div>
    </div>
));

interface CustomSortableContainerProps extends SortableContainerProps {
    togglePopover: (stage: boolean) => void;
}


const ScenarioSortableContainer = SortableContainer<CustomSortableContainerProps>(({ children, togglePopover }: any) => {
    return <div className="sortable-container">
        <div className="sortable-body" id="sortable-body">
            {children}
        </div>
        <div className="sortable-footer">
            <Button className="button-v2" type="primary" htmlType="submit" onClick={() => {
                togglePopover(false)
            }}>
                {getIntlMessage("done").toUpperCase()}
            </Button>
        </div>
    </div >;
});


interface ScenarioInstanceProps {
    session: FixSession;
    scenario: Scenario;
}

interface ScenarioInstanceState {
    connected: boolean,
    addStageVisible: boolean,
    sortStagesVisible: boolean,
    editStageVisible?: string,
    addMsgVisible: boolean,
    addFavoriteVisible: boolean,
    activeStage?: { stage: Stage, type: "IN" | "OUT", msg?: FixComplexType };
}

export class ScenarioInstance extends React.Component<ScenarioInstanceProps, ScenarioInstanceState> {
    private updateSub?: Subscription;
    private sessionSub?: Subscription;

    constructor(props: any) {
        super(props)
        this.state = {
            connected: this.props.session.isReady(),
            addStageVisible: false,
            sortStagesVisible: false,
            addMsgVisible: false,
            addFavoriteVisible: false,
            activeStage: undefined,
            editStageVisible: undefined,
        }

    }

    componentDidMount() {

        this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
            this.forceUpdate();
            this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT })
        })

        this.updateSub = this.props.scenario.getStageUpdateObservable().subscribe(() => {
            this.forceUpdate();
        })
    }

    componentWillUnmount() {
        this.updateSub?.unsubscribe();
        this.sessionSub?.unsubscribe();
    }

    private toggleEditPopover = (name: string) => {
        this.setState({ editStageVisible: name })
    }

    private genExtraHeader = (stage: Stage) => {
        const { editStageVisible } = this.state;
        const failedReason = stage.getFailedReason();

        return <div className="stage-extra-header">
            {stage.isWaiting() && <div className="waiting-stage-state">{getIntlMessage("waiting_state")}</div>}
            {!stage.isSkipped() && <div className={`stage-state ${stage.getState().toLowerCase()}-label`}>
                <Tooltip title={failedReason}>
                    <span>{stage.getState()}</span>
                </Tooltip>
            </div>}
            <div className="skip-stage">{<Checkbox disabled={this.isDisabled()} checked={stage.isSkipped()} onChange={e => {
                stage.setSkipped(e.target.checked);
                this.forceUpdate();
            }}>{getIntlMessage("skip")}</Checkbox>
            }</div>
            <Popover
                content={<AddStageForm togglePopover={() => this.toggleEditPopover("")} value={{
                    name: stage.name, waitTime: stage.getWaitTime(),
                    stageWaitTime: stage.getStageWaitTime()
                }}
                    onAdded={(data) => { this.onEditStage(stage, data.name, data.waitTime, data.stageWaitTime) }} />}
                title={getIntlMessage("edit_stage").toUpperCase()}
                placement="top"
                visible={editStageVisible === stage.name}
            >
                <Tooltip title={getIntlMessage("rename")} >
                    <EditOutlined onClick={(e) => {
                        e.stopPropagation();
                        if (this.isDisabled()) { return }

                        this.toggleEditPopover(stage.name);
                    }} />
                </Tooltip>
            </Popover>
            <Tooltip title={getIntlMessage("delete")} >
                <DeleteOutlined onClick={(e) => {
                    e.stopPropagation();
                    if (this.isDisabled()) { return }

                    this.props.scenario.removeStage(stage.name);
                    this.forceUpdate()
                }} />
            </Tooltip>
        </div>
    }

    private onEditStage = (stage: Stage, name: string, waitTime?: number, stageWaitTime?: number) => {
        stage.name = name;
        stage.setWaitTime(waitTime)
        stage.setStageWaitTime(stageWaitTime)
        this.forceUpdate();
    }

    private isDisabled = () => {
        return this.props.scenario.getState() === "EXECUTING"
    }

    private getMenu = (stage: Stage, type: "IN" | "OUT") => {
        return <Menu>
            <Menu.Item key="1" onClick={() => {
                this.setState({ activeStage: { stage, type }, addFavoriteVisible: true })
            }}>{getIntlMessage("from_favorites")}</Menu.Item>

            <Menu.Item key="2" onClick={() => {
                this.setState({ activeStage: { stage, type }, addMsgVisible: true })
            }}>{getIntlMessage("new_message")}</Menu.Item>
        </Menu>
    }

    private onSortEnd = ({ oldIndex, newIndex }: any) => {
        this.props.scenario.reArrangeStages(oldIndex, newIndex);
        this.forceUpdate();
    };

    getStage(stage: Stage) {
        return <Panel header={stage.name} key={stage.name} className={stage.getState() === "EXECUTING" ? "executing" : ""} extra={this.genExtraHeader(stage)}>
            {stage.isSkipped() && <div className="skipped"></div>}
            <div className="stage">
                <div className="input">
                    <div className="section-header">
                        {getIntlMessage("input")}
                    </div>
                    <div className="section-body">
                        <div className="msg-header">
                            <Dropdown disabled={this.isDisabled()} overlay={this.getMenu(stage, "IN")}>
                                <Button disabled={this.isDisabled()} type="ghost" icon={<PlusOutlined />}>{getIntlMessage("add_msg")}</Button>
                            </Dropdown>
                        </div>
                        <div className="msg-body">
                            {stage.getInput() && <div className="msg">{stage.getInput()?.name}
                                <div className="action-btns">
                                    <Tooltip title={getIntlMessage("edit")}>
                                        <Button disabled={this.isDisabled()} shape="circle" icon={<EditOutlined />} onClick={() => {
                                            this.setState({ activeStage: { stage, type: "IN", msg: stage.getInput() }, addMsgVisible: true })
                                        }} />
                                    </Tooltip>
                                    <Tooltip title={getIntlMessage("delete")}>
                                        <Button disabled={this.isDisabled()} shape="circle" icon={<DeleteOutlined />} onClick={() => {
                                            stage.removeInputNsg();
                                            this.forceUpdate();
                                        }} />
                                    </Tooltip>
                                </div>
                            </div>}
                        </div>
                    </div>
                </div>
                <div className="output">
                    <div className="section-header">
                        {getIntlMessage("output")}
                    </div>
                    <div className="section-body">
                        <div className="msg-header">
                            <Dropdown disabled={this.isDisabled()} overlay={this.getMenu(stage, "OUT")}>
                                <Button disabled={this.isDisabled()} type="ghost" icon={<PlusOutlined />}>{getIntlMessage("add_msg")}</Button>
                            </Dropdown>
                        </div>
                        <div className="msg-body">
                            {stage.getAllOutputMsgs().map((msg, index) => <div key={index} className="msg">{msg.name}
                                <div className="action-btns">
                                    <Tooltip title={getIntlMessage("edit")}>
                                        <Button disabled={this.isDisabled()} shape="circle" icon={<EditOutlined />} onClick={() => {
                                            this.setState({ activeStage: { stage, type: "OUT", msg }, addMsgVisible: true })
                                        }} />
                                    </Tooltip>
                                    <Tooltip title={getIntlMessage("delete")}>
                                        <Button disabled={this.isDisabled()} shape="circle" icon={<DeleteOutlined />} onClick={() => {
                                            stage.removeOutputMsg(msg.name);
                                            this.forceUpdate();
                                        }} />
                                    </Tooltip>
                                </div>
                            </div>)}
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    }

    private toggleNewStagePopover = (state: boolean) => {
        this.setState({ addStageVisible: state })
    }

    private toggleSortStagesPopover = (state: boolean) => {
        this.setState({ sortStagesVisible: state })
    }

    private onAddNewStage = (name: string, waitTime: number, stageWaitTime: number) => {
        this.props.scenario.addStage(name, waitTime, false, stageWaitTime);
        this.setState({ addMsgVisible: false })
        this.forceUpdate();
    }

    private getContainer = () => {
        const scrollingContainer = document.getElementById('sortable-body');
        return scrollingContainer ?? document.body;
    }

    render() {
        const { scenario, session, } = this.props;
        const { addStageVisible, sortStagesVisible, addMsgVisible, activeStage, addFavoriteVisible } = this.state;

        return <React.Fragment>
            <div className="add-btn">
                <Popover
                    content={<AddStageForm togglePopover={this.toggleNewStagePopover} onAdded={(data) => { this.onAddNewStage(data.name, data.waitTime, data.stageWaitTime) }} />}
                    title={getIntlMessage("add_new_stage").toUpperCase()}
                    placement="top"
                    visible={addStageVisible}
                >
                    <Button type="ghost" disabled={this.isDisabled()} icon={<PlusOutlined />} onClick={() => this.toggleNewStagePopover(true)}>{getIntlMessage("add_new_stage")}</Button>
                </Popover>
                <Popover
                    content={
                        <ScenarioSortableContainer onSortEnd={this.onSortEnd} togglePopover={this.toggleSortStagesPopover}
                            useDragHandle getContainer={this.getContainer}>
                            {scenario.getAllStages().map((stage, index) => (
                                <SortableItem
                                    index={index}
                                    stage={stage}
                                    key={`item-${stage.name}`}
                                />
                            ))}
                        </ScenarioSortableContainer>
                    }
                    title={getIntlMessage("sort_stages").toUpperCase()}
                    placement="top"
                    visible={sortStagesVisible}
                >
                    <Button style={{ marginLeft: 5 }} type="ghost" disabled={this.isDisabled()} icon={<SortAscendingOutlined />}
                        onClick={() => { this.toggleSortStagesPopover(true) }}>{getIntlMessage("sort_stages")}</Button>
                </Popover>

            </div>
            <Collapse>
                {scenario.getAllStages().map(stage => this.getStage(stage))}
            </Collapse>
            {
                addMsgVisible && <AddMsgModal type={activeStage?.type} editMsg={activeStage?.msg} onAdd={(msg: FixComplexType) => {
                    if (activeStage) {
                        if (activeStage.msg) {
                            activeStage.msg.setValue(msg.getValue());
                            this.setState({ addMsgVisible: false })
                            return
                        }

                        if (activeStage.type === "IN") {
                            activeStage.stage.setInput(msg)
                        } else {
                            activeStage.stage.addOutputMsg(msg)
                        }
                    }

                    this.setState({ addMsgVisible: false })
                }} session={session} visible={addMsgVisible} closable={true} onDialogClosed={() => {
                    this.setState({ addMsgVisible: false })
                }} />
            }
            {
                addFavoriteVisible && <AddFavoriteModal onAdd={(msg: FixComplexType) => {
                    if (activeStage) {
                        if (activeStage.type === "IN") {
                            activeStage.stage.setInput(msg)
                        } else {
                            activeStage.stage.addOutputMsg(msg)
                        }
                    }

                    this.setState({ addFavoriteVisible: false })
                }} session={session} visible={addFavoriteVisible} closable={true} onDialogClosed={() => {
                    this.setState({ addFavoriteVisible: false })
                }} />
            }
        </React.Fragment >
    }
}


