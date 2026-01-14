import { LM } from "src/translations/language-manager";
import React from "react";
import { ModalBox } from "src/common/Modal/ModalBox";
import "./AddFavoriteModal.scss";
import { FixComplexType } from "src/services/fix/FixDefs";
import { FixSession } from "src/services/fix/FixSession";
import { Button, } from "antd";
import { GlobalServiceRegistry } from "src/services/GlobalServiceRegistry";
import { makeCancelable } from "src/utils/utils";
import { Spin } from 'antd';
import { LoadingOutlined } from "@ant-design/icons";
import { LogService } from "src/services/log-management/LogService";

interface AddFavoriteModalProps {
    visible: boolean;
    closable?: boolean;
    className?: string;
    onDialogClosed: () => void;
    session: FixSession;
    onAdd: (msg: FixComplexType) => void;
}

interface AddFavoriteModalState {
    favorites: { name: string, msg: FixComplexType }[];
    loading: boolean;
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`scenarios.${msg}`);
}

export class AddFavoriteModal extends React.Component<AddFavoriteModalProps, AddFavoriteModalState> {
    private favPromise: any;

    constructor(props: any) {
        super(props);
        this.state = {
            favorites: [],
            loading: false
        }
    }

    componentDidMount() {
        this.getAllFavorites();
    }

    componentWillUnmount() {
        this.favPromise?.cancel();
    }

    private getAllFavorites = () => {
        this.setState({ loading: true })
        this.favPromise = makeCancelable(GlobalServiceRegistry.favoriteManager.getAllFavorites(this.props.session));
        this.favPromise.promise.then((favorites: any) => {
            this.setState({ favorites, loading: false });
        }).catch((error: any) => {
            if (error.isCanceled) {
                return;
            }
            this.setState({ loading: false })
            LogService.error("Failed to load favorites")
        })
    }

    private getFavorites = () => {
        const { favorites } = this.state;
        return <div className="favorite-container">
            <div className="fav-row">
                <div className="fav-header">{getIntlMessage("fav_name")}</div>
                <div className="fav-header">{getIntlMessage("fav_msg")}</div>
                <div></div>
            </div>
            {favorites.map(({ name, msg }, index) => {
                return <div className="fav-row" key={index}>
                    <div>{name}</div>
                    <div>{msg.name}</div>
                    <div><Button size="small" type="primary" onClick={() => {
                        this.props.onAdd(msg);
                    }}>{getIntlMessage("select")}</Button></div>
                </div>
            })}
        </div>
    }

    render() {
        const { visible, className, onDialogClosed, closable } = this.props;
        const { loading } = this.state;
        return (
            <ModalBox
                visible={visible}
                title={getIntlMessage("select_fav_title")}
                closable={closable ?? true}
                onClose={(onDialogClosed)}
                className={`modal-box add-msg-modal ${className ? className : ""}`}
                width={420}
            >
                <div className="add-msg-wrapper">
                    <div className="body">
                        {loading && <div className="loading-container">
                            <Spin className="spinner" indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} /> </div>}
                        {!loading && this.getFavorites()}
                    </div>
                </div>
            </ModalBox>)
    }
}