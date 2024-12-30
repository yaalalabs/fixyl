
import React from 'react';
import { Subscription } from 'rxjs';
import { FixComplexType } from 'src/services/fix/FixDefs';
import { BaseClientFixSession, FixSession, FixSessionEventType, } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import { Tree, Input, Button, Popover, Tooltip, Drawer, Form, Switch } from 'antd';
import './Favorites.scss';
import { DeleteOutlined, EditOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons';
// import ReactJson from 'react-json-view';
import { FixForm } from './FixForm';
import { Toast } from 'src/common/Toast/Toast';

const { Search } = Input;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`session_management.${msg}`, options);
}

interface TreeNode {
    name: string;
    key: string;
    children: TreeNode[];
    favorite?: FixComplexType;
}

interface FavoritesProps {
    session: BaseClientFixSession;
}

interface FavoritesState {
    favorites: TreeNode[];
    allNodes: TreeNode[];
    expandedKeys: any[],
    searchValue: string,
    autoExpandParent: boolean,
    connected: boolean,
    editVisible: boolean,
    editMsg?: FixComplexType,
    currentFavName?: string,
    removeNonFilledFields: boolean,
}

const getParentKey = (key: string, tree: TreeNode[]): string | undefined => {
    let parentKey;
    for (let i = 0; i < tree.length; i++) {
        const node = tree[i];
        if (node.children) {
            if (node.children.some(item => item.key === key)) {
                parentKey = node.key;
            } else if (getParentKey(key, node.children)) {
                parentKey = getParentKey(key, node.children);
            }
        }
    }
    return parentKey;
};

export class Favorites extends React.Component<FavoritesProps, FavoritesState> {
    private updateSub?: Subscription;
    private sessionSub?: Subscription;

    constructor(props: any) {
        super(props)
        this.state = {
            favorites: [],
            expandedKeys: [],
            searchValue: '',
            allNodes: [],
            autoExpandParent: true,
            editVisible: false,
            removeNonFilledFields: false,
            connected: this.props.session.isReady(),
            currentFavName: undefined
        }

    }

    componentDidMount() {
        this.fetchFavorites();

        this.updateSub = GlobalServiceRegistry.favoriteManager.getFavoriteUpdateObservable().subscribe(() => {
            this.forceUpdate();
            this.fetchFavorites();
        })

        this.subscribeSession();
    }

    componentDidUpdate(prevProps: Readonly<FavoritesProps>, prevState: Readonly<FavoritesState>, snapshot?: any): void {
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
    }

    private fetchFavorites() {
        GlobalServiceRegistry.favoriteManager.getAllFavorites(this.props.session).then(favorites => {
            const dataMap = new Map<string, TreeNode>()
            const allNodes: TreeNode[] = [];
            favorites.forEach(fav => {
                let node = dataMap.get(fav.msg.name);
                if (!node) {
                    node = {
                        name: fav.msg.name, key: `${fav.msg.name}_parent`, children: []
                    }
                    dataMap.set(fav.msg.name, node)
                }
                const child = { name: fav.name, key: `${fav.name}_child`, favorite: fav.msg, children: [] };
                allNodes.push(child);
                node.children.push(child);
            })
            this.setState({ favorites: Array.from(dataMap.values()), allNodes })
        }).catch(error => {
            console.log("Failed to load favorites")
        })
    }

    onExpand = (expandedKeys: any[]) => {
        this.setState({
            expandedKeys,
            autoExpandParent: false,
        });
    }

    onChange = (e: any) => {
        const { allNodes, favorites } = this.state;
        const { value } = e.target;
        const expandedKeys = allNodes.map(item => {
            if (item.key.indexOf(value) > -1) {
                return getParentKey(item.key, favorites);
            }
            return null;
        })
            .filter((item, i, self) => item && self.indexOf(item) === i);
        this.setState({
            expandedKeys,
            searchValue: value,
            autoExpandParent: true,
        });
    }

    private getTreeNode = (title: any, name: string, msg?: FixComplexType) => {
        const { connected } = this.state;

        return <div className="node-wrapper">
            {title}
            {msg && <div className="action-wrapper" onClick={(e) => e.stopPropagation()}>
                <Tooltip title={getIntlMessage("edit")}>
                    <Button className="action-btn" icon={<EditOutlined />} onClick={() => this.onEditOpen(msg, name)}></Button>
                </Tooltip>
                <Tooltip title={getIntlMessage("send")}>
                    <Button className="action-btn" disabled={!connected} onClick={() => {
                        this.props.session.send(msg)
                    }} icon={<SendOutlined />}></Button>
                </Tooltip>
                <Popover title={getIntlMessage("message", { msg: msg.name })} placement="right"
                    trigger="click" overlayClassName="msg-view-wrapper"
                    content={<div className="msg-view">
                        {/* <ReactJson src={msg.getValue()} theme="google" style={{ backgroundColor: "transparent" }} /> */}
                    </div>}>
                    <Tooltip title={getIntlMessage("view")}>
                        <Button className="action-btn" icon={<EyeOutlined />}></Button>
                    </Tooltip>
                </Popover>
                {this.props.session.getType() === "CLIENT" && <Tooltip title={getIntlMessage("delete")}>
                    <Button className="action-btn" onClick={() => {
                        GlobalServiceRegistry.favoriteManager.deleteFavorite((this.props.session as FixSession).getProfile() as any, msg, name).then(() => {
                            Toast.success(getIntlMessage("fav_delete_success_title"), getIntlMessage("fav_delete_success", { name }))
                        }).catch(error => {
                            Toast.error(getIntlMessage("fav_delete_failed_title"), getIntlMessage("fav_delete_failed"))
                        })
                    }} icon={<DeleteOutlined />}></Button>
                </Tooltip>}
            </div>}
        </div>
    }

    private onEditOpen = (editMsg: FixComplexType, name: string) => {
        this.setState({ editVisible: true, editMsg, currentFavName: name })
    }

    private onEditClose = () => {
        this.setState({ editVisible: false });

        setTimeout(() => {
            this.setState({ editMsg: undefined, currentFavName: undefined })
        }, 120)
    }


    private onNonFilledChanged = (removeNonFilledFields: boolean) => {
        this.setState({ removeNonFilledFields })
    }

    render() {
        const { searchValue, expandedKeys, autoExpandParent, favorites, editVisible, editMsg,
            connected, removeNonFilledFields, currentFavName } = this.state;
        const { session } = this.props;

        const loop = (data: TreeNode[]): any =>
            data.map(item => {
                const index = item.name.indexOf(searchValue);
                const beforeStr = item.name.substr(0, index);
                const afterStr = item.name.substr(index + searchValue.length);
                const title =
                    index > -1 ? (
                        this.getTreeNode(<span>
                            {beforeStr}
                            <span className="site-tree-search-value">{searchValue}</span>
                            {afterStr}
                        </span>, item.name, item.favorite)
                    ) : (
                        this.getTreeNode(<span>{item.name}</span>, item.name, item.favorite)
                    );
                if (item.children) {
                    return { title, key: item.key, children: loop(item.children) };
                }

                return {
                    title,
                    key: item.key,
                };
            });
        return <div className="favorites-wrapper">
            <div className="header">
                {getIntlMessage("favorites_title")}
                <Search style={{ marginTop: 8, marginBottom: 5 }} placeholder="Search" onChange={this.onChange} />
            </div>
            <div className="body">
                <Tree
                    onExpand={this.onExpand}
                    expandedKeys={expandedKeys}
                    autoExpandParent={autoExpandParent}
                    treeData={loop(favorites)}
                />
            </div>
            {editMsg && <Drawer
                title={<div className="edit-drawer-header">{getIntlMessage("edit_msg", { msg: editMsg.name })}
                    <Form className="form-container">
                        <Form.Item name="switch" label={getIntlMessage("remove_non_filled_fields")} >
                            <Switch checked={removeNonFilledFields} onChange={this.onNonFilledChanged} />
                        </Form.Item>
                    </Form>
                </div>}
                placement="right"
                onClose={this.onEditClose}
                visible={editVisible}
                getContainer={false}
                width={420}
                style={{ position: 'absolute' }}
            >
                <FixForm message={editMsg} session={session} name="fav" value={editMsg.getValue()} hideTitle={true}
                    removeNonFilledFields={removeNonFilledFields} preferredFavName={currentFavName}
                    disabled={!connected} onSend={(data) => {
                        const msg = editMsg.clone();
                        msg.setValue(data);
                        session.send(msg)
                    }} />
            </Drawer>}
        </div>
    }
}


