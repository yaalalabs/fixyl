import { ClearOutlined, SwapOutlined, WechatOutlined, MoreOutlined } from '@ant-design/icons';
import { Switch, Form, Button, Tooltip, Checkbox, Popover, } from 'antd';
import { AgGridColumn, AgGridReact } from '@ag-grid-community/react';
import { AllCommunityModules, ColumnApi, GridApi, } from '@ag-grid-community/all-modules';
import React from 'react';
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import './SessoinMessageStream.scss';
import { transformDate } from 'src/utils/utils';
import { Subscription } from 'rxjs';
import { IntraTabCommunicator } from '../../../../common/IntraTabCommunicator';
import { MessageDiffViewer } from './MessageDiffViewer';

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`session_message_stream.${msg}`);
}

export const DirectionComponent = (props: any) => {
  const isIn = props.value === 'IN';
  return <span className={`direction-renderer ${isIn ? 'in' : 'out'}-cell`}>
    {isIn ? '⬇' : '⬆'}
  </span>;
}

interface SessoinMessageStreamProps {
  session: FixSession;
  communicator: IntraTabCommunicator;
}

interface SessoinMessageStreamState {
  columnConfig: any;
  rowData: any[];
  selectedRow?: any;
  selectedRows?: any[];
  hb: boolean;
  input: boolean;
  output: boolean;
  showDiffModal: boolean;
  diffModeEnabled: boolean;
  scrollLocked: boolean;
  minimizedMode: boolean;
}

export class SessoinMessageStream extends React.Component<SessoinMessageStreamProps, SessoinMessageStreamState> {
  protected gridApi?: GridApi;
  protected gridColumnApi?: ColumnApi;
  private sessionSub?: Subscription;
  private ref: any = React.createRef();
  private resizeObserver: any;

  constructor(props: any) {
    super(props);

    this.state = {
      columnConfig: [
        {
          label: "", key: 'direction', width: 30, minWidth: 30, maxWidth: 30, sortable: false,
          pinned: true, headerClassName: "hide-resizer", renderer: "directionRenderer"
        },
        { label: getIntlMessage("message"), key: 'message', flex: 1 },
        { label: getIntlMessage("sequence"), key: 'sequence', width: 130, type: "number" },
        { label: getIntlMessage("time"), key: 'time', width: 100, type: "time" }

      ],
      rowData: [],
      hb: true,
      input: true,
      output: true,
      showDiffModal: false,
      diffModeEnabled: false,
      scrollLocked: true,
      minimizedMode: false
    }
  }

  protected getCellRenderer = (col: any) => {
    return col.renderer;
  }

  protected getValueGetter = (col: any, params: any) => {
    if (col.type === 'time') {
      return transformDate(params.data[col.key], 'HH:mm:ss:ms');
    }

    return params.data[col.key];
  }

  protected onGridReady = (params: any): void => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  }

  componentDidMount() {
    this.sessionSub = this.props.session.getFixEventObservable().subscribe(event => {
      const { data } = event;
      if (event.event === FixSessionEventType.DATA && data) {
        const id = data.msg.name + data.timestamp;
        const addedRow = this.gridApi?.applyTransaction({
          add: [{
            direction: data.direction, message: data.msg.name,
            length: data.length, time: data.timestamp, msg: data.msg,
            rawMsg: data.fixMsg, sequence: data.sequence, id
          }]
        });

        if (this.state.scrollLocked) {
          setImmediate(() => {
            this.gridApi?.ensureIndexVisible(addedRow?.add[0].rowIndex, 'bottom');
          })
        }
      }
    })

    this.onResizeObserver();
  }

  componentWillUnmount() {
    this.sessionSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  private onResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      if (!Array.isArray(entries)) {
        return;
      }

      const entry = entries[0];
      const width = (entry.contentRect.width);

      if (width < 491) {
        this.setState({ minimizedMode: true });
      } else {
        this.setState({ minimizedMode: false });
      }
    });

    this.resizeObserver.observe(this.ref.current);
  }

  private onRowSelected = (event: any) => {
    this.setState({ selectedRow: event.data });
    this.props.communicator.onMessageSelected({ def: event.data.msg as any, session: this.props.session, rawMsg: event.data.rawMsg });

    const rows = this.gridApi?.getSelectedRows();
    if (rows?.length === 2) {
      this.setState({ selectedRows: rows.map(row => JSON.stringify(row.msg.getValue(), null, 2)), diffModeEnabled: true })
    } else {
      this.setState({ selectedRows: [], diffModeEnabled: false })
    }
  }

  private onFilterHB = (hb: boolean) => {
    this.setState({ hb })
    if (!hb) {
      const filterModel = this.gridApi?.getFilterModel();
      this.gridApi?.setFilterModel({
        ...filterModel,
        message: {
          filterType: 'text',
          type: 'notEqual',
          filter: ["Heartbeat"]
        }
      });
    } else {
      const filterModel = this.gridApi?.getFilterModel();
      this.gridApi?.setFilterModel({ ...filterModel, message: null });
    }

    this.gridApi?.onFilterChanged();
  }

  private onFilterInput = (input: boolean) => {
    this.setState({ input })
    if (!input) {
      const filterModel = this.gridApi?.getFilterModel();
      this.gridApi?.setFilterModel({
        ...filterModel,
        direction: {
          filterType: 'text',
          type: 'equals',
          filter: ["IN"]
        }
      });
    } else {
      const filterModel = this.gridApi?.getFilterModel();
      this.gridApi?.setFilterModel({ ...filterModel, direction: null });
    }

    this.gridApi?.onFilterChanged();
  }

  private onFilterOutput = (output: boolean) => {
    this.setState({ output })
    if (!output) {
      const filterModel = this.gridApi?.getFilterModel();

      this.gridApi?.setFilterModel({
        ...filterModel,
        direction: {
          filterType: 'text',
          type: 'equals',
          filter: ["OUT"]
        }
      });
    } else {
      const filterModel = this.gridApi?.getFilterModel();
      this.gridApi?.setFilterModel({ ...filterModel, direction: null });
    }

    this.gridApi?.onFilterChanged();
  }

  private onScrollLockChanged = (e: any) => {
    this.setState({ scrollLocked: e.target.checked })
  }

  private onClear = () => {
    this.gridApi?.setRowData([])
  }

  private getPopoverForm = () => {
    const { input, output, hb, } = this.state;
    return <div className="menu-popover">
      <Form.Item name="switch" label={getIntlMessage("hide_hb")} >
        <Switch checked={hb} onChange={this.onFilterHB} />
      </Form.Item>
      <Form.Item name="switch" label={getIntlMessage("input")} >
        <Switch checked={input} onChange={this.onFilterInput} />
      </Form.Item>
      <Form.Item name="switch" label={getIntlMessage("output")} >
        <Switch checked={output} onChange={this.onFilterOutput} />
      </Form.Item>
    </div>
  }

  render() {
    const { columnConfig, diffModeEnabled, selectedRows, input,
      output, hb, showDiffModal, scrollLocked, minimizedMode } = this.state;

    return <div className="session-message-stream-wrapper" ref={this.ref}>
      <div className="header">
        <div className="title"><WechatOutlined />{getIntlMessage("title")}</div>
        <Form className="form-container">
          <Tooltip title={getIntlMessage("diff")}>
            <Button shape="circle" disabled={!diffModeEnabled} onClick={() => {
              this.setState({ showDiffModal: true })
            }} icon={<SwapOutlined />}></Button>
          </Tooltip>

          {!minimizedMode && <div className="maximized-header">
            <Form.Item name="switch" label={getIntlMessage("hide_hb")} >
              <Switch checked={hb} onChange={this.onFilterHB} />
            </Form.Item>
            <Form.Item name="switch" label={getIntlMessage("input")} >
              <Switch checked={input} onChange={this.onFilterInput} />
            </Form.Item>
            <Form.Item name="switch" label={getIntlMessage("output")} >
              <Switch checked={output} onChange={this.onFilterOutput} />
            </Form.Item>
          </div>}
          {minimizedMode && <div className="minimized-header">
            <Popover content={this.getPopoverForm} trigger={["click"]} overlayClassName="header-menu-wrapper">
              <div className="menu-button">
                <MoreOutlined />
              </div>
            </Popover>
          </div>}
        </Form>
      </div>
      <div className="body">
        <div className="ag-theme-alpine message-table" >
          <AgGridReact
            modules={AllCommunityModules}
            rowData={this.state.rowData}
            onGridReady={this.onGridReady}
            rowSelection="multiple"
            onCellClicked={this.onRowSelected}
            getRowNodeId={(data) => data.id}
            frameworkComponents={{
              directionRenderer: DirectionComponent,
            }}
            animateRows={true}>
            {columnConfig.map((col: any) => {
              return <AgGridColumn
                field={col.key}
                resizable={true}
                key={col.key}
                sortable={true}
                sort={col.sort}
                hide={col.hide ?? false}
                type={col.type === 'number' ? 'numericColumn' : undefined}
                headerName={col.label}
                initialWidth={col.width || 200}
                initialFlex={col.flex}
                minWidth={col.minWidth}
                maxWidth={col.maxWidth}
                cellClass={col.className}
                headerClass={col.headerClassName}
                cellClassRules={{
                  'right-aligned': () => col.type === 'number',
                  'direction-cell': () => col.key === 'direction',
                }}
                cellRenderer={this.getCellRenderer(col)}
                valueGetter={(params) => this.getValueGetter(col, params)}
                suppressMovable={true}
              />
            })}
          </AgGridReact>
          <MessageDiffViewer msg1={selectedRows?.[0]} msg2={selectedRows?.[1]} visible={showDiffModal} closable={true} onDialogClosed={() => {
            this.setState({ showDiffModal: false })
          }} />
        </div>

      </div>
      <div className="footer">
        <Button onClick={this.onClear} icon={<ClearOutlined />} className="clear-btn"> {getIntlMessage("clear")}</Button>
        <Checkbox onChange={this.onScrollLockChanged} checked={scrollLocked}>{getIntlMessage("scroll_lock")}</Checkbox>
      </div>
    </div>
  }
}

