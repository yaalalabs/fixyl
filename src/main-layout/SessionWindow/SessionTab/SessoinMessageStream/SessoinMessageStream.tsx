import { ClearOutlined, SwapOutlined, WechatOutlined, MoreOutlined, DiffOutlined } from '@ant-design/icons';
import { Switch, Form, Button, Tooltip, Checkbox, Popover, } from 'antd';
import React from 'react';
import { BaseClientFixSession, FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import './SessoinMessageStream.scss';
import { transformDate } from 'src/utils/utils';
import { Subscription } from 'rxjs';
import { IntraTabCommunicator, FixCommMsg } from '../../../../common/IntraTabCommunicator';
import { MessageDiffViewer } from './MessageDiffViewer';
import { ColDef, ColumnApi, GridApi } from 'ag-grid-community';
import { AgGridReact } from "ag-grid-react";

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`session_message_stream.${msg}`);
}

interface SessoinMessageStreamProps {
  session: BaseClientFixSession;
  communicator: IntraTabCommunicator;
}


interface SessoinMessageStreamState {
  columnConfig: any;
  rowData: any[];
  selectedRow?: FixCommMsg;
  selectedRows?: FixCommMsg[];
  hb: boolean;
  input: boolean;
  output: boolean;
  showDiffModal: boolean;
  showSideBySideModal: boolean;
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
          pinned: true, headerClassName: "hide-resizer"
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
      minimizedMode: false,
      showSideBySideModal: false
    }
  }

  protected getCellRenderer = (col: any) => {
    return col.renderer;
  }

  protected getValueGetter = (col: any, params: any) => {
    if (col.type === 'time') {
      return transformDate(params.data[col.key], 'HH:mm:ss:ms');
    } else if (col.key === 'direction') {
      const isIn = params.data[col.key] === 'IN';
      return isIn ? '⬇' : '⬆'
    }

    return params.data[col.key];
  }

  protected onGridReady = (params: any): void => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  }

  componentDidMount() {
    this.subscribeSession()
    this.onResizeObserver();
  }


  private subscribeSession() {
    this.sessionSub?.unsubscribe();
    this.setState({ rowData: this.props.session.getEventHistory().map(event => this.getDataFromEvent(event)).filter(data => !!data) })

    this.sessionSub = this.props.session.getFixEventObservable().subscribe(event => {
      const data = this.getDataFromEvent(event)
      if (data) {

        const addedRow = this.gridApi?.applyTransaction({
          add: [data]
        })

        if (this.state.scrollLocked) {
          setImmediate(() => {
            addedRow?.add[0].rowIndex && this.gridApi?.ensureIndexVisible(addedRow?.add[0].rowIndex, 'bottom');
          })
        }

      }
    })
  }

  private getDataFromEvent(event: any) {
    const { data } = event;

    if (event.event === FixSessionEventType.DATA && data) {
      const id = data.msg.name + data.timestamp;
      return {
        direction: data.direction, message: data.msg.name,
        length: data.length, time: data.timestamp, msg: data.msg,
        rawMsg: data.fixMsg, sequence: data.sequence, id
      }

    }

    return null;
  }

  componentDidUpdate(prevProps: Readonly<SessoinMessageStreamProps>, prevState: Readonly<SessoinMessageStreamState>, snapshot?: any): void {
    if (prevProps.session !== this.props.session) {
      this.subscribeSession()
    }
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
    const node = this.gridApi?.getDisplayedRowAtIndex(event.rowIndex);

    this.setState({ selectedRow: node?.data });
    this.props.communicator.onMessageSelected({ def: node?.data.msg as any, session: this.props.session, rawMsg: node?.data.rawMsg });

    const rows = this.gridApi?.getSelectedRows();
    if (rows?.length === 2) {
      this.setState({
        selectedRows: rows.map((row: any) => ({
          def: row.msg,
          rawMsg: JSON.stringify(row.msg.getValue(), null, 2),
          session: this.props.session
        })), diffModeEnabled: true
      })
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
          filter: ["⬇"]
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
          filter: ["⬆"]
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


  private getColDef = (cols: any[]): ColDef[] => {
    return cols.map(col => ({
      field: col.key,
      resizable: true,
      key: col.key,
      sortable: true,
      sort: col.sort,
      hide: col.hide ?? false,
      type: col.type === 'number' ? 'numericColumn' : undefined,
      headerName: col.label,
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
      initialWidth: col.width || 200,
      initialFlex: col.flex,
      cellClass: col.className,
      headerClass: col.headerClassName,
      cellRenderer: this.getCellRenderer(col),
      pinned: col.pinned,
      lockPinned: true,
      lockPosition: col.key === 'checked',
      cellClassRules: {
        'right-aligned': () => col.type === 'number',
        'direction-cell': () => col.key === 'direction',
        'in-cell': (params) => col.key === 'direction' && params.value === "⬇",
        'out-cell': (params) => col.key === 'direction' && params.value === "⬆",
      },
      filter: true,
      filterParams: col.filterParams,
      suppressColumnsToolPanel: col.type === 'custom',
      valueGetter: (params: any) => this.getValueGetter(col, params),
      comparator: col.comparator,
    }));
  }

  render() {
    const { columnConfig, diffModeEnabled, selectedRows, input,
      output, hb, showDiffModal, showSideBySideModal, scrollLocked, minimizedMode } = this.state;

    return <div className="session-message-stream-wrapper" ref={this.ref}>
      <div className="header">
        <div className="title"><WechatOutlined />{getIntlMessage("title")}</div>
        <Form className="form-container">
          <Tooltip title={getIntlMessage("diff")}>
            <Button shape="circle" disabled={!diffModeEnabled} onClick={() => {
              this.setState({ showDiffModal: true })
            }} icon={<DiffOutlined />}></Button>
          </Tooltip>
          <Tooltip title={getIntlMessage("side_by_side")}>
            <Button shape="circle" disabled={!diffModeEnabled} onClick={() => {
              this.setState({ showSideBySideModal: true })
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
            onGridReady={this.onGridReady}
            rowData={this.state.rowData}
            suppressMenuHide={false}
            animateRows
            rowSelection="multiple"
            detailCellRendererParams={{ refreshStrategy: 'everything' }}
            onCellFocused={this.onRowSelected}
            getRowId={({ data }: any) => data.id}
            columnDefs={this.getColDef(columnConfig)}
          />
          {/* <AgGridReact
            modules={AllCommunityModules}
            rowData={this.state.rowData}
            onGridReady={this.onGridReady}
            rowSelection="multiple"
            onCellClicked={this.onRowSelected}
            getRowNodeId={(data) => data.id}
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
                  'in-cell': (params) => col.key === 'direction' && params.value === "⬇",
                  'out-cell': (params) => col.key === 'direction' && params.value === "⬆",
                }}
                cellRenderer={this.getCellRenderer(col)}
                valueGetter={(params) => this.getValueGetter(col, params)}
                suppressMovable={true}
              />
            })}
          </AgGridReact> */}
          <MessageDiffViewer msg1={selectedRows?.[0]?.rawMsg} msg2={selectedRows?.[1]?.rawMsg} visible={showDiffModal || showSideBySideModal}
            sideBySide={showSideBySideModal}
            msgObj1={selectedRows?.[0]} msgObj2={selectedRows?.[1]}
            closable={true} onDialogClosed={() => {
              this.setState({ showDiffModal: false, showSideBySideModal: false })
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

