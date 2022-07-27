
import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import "./WaitingOverlay.scss";

export interface WaitingOverlayProps {
    fontSize?: number;
    style?: React.CSSProperties;
    className?: string;
    text?: string;
}

export function WaitingOverlay(props: WaitingOverlayProps) {
    const { fontSize, style, className, text } = props;
    const antIcon = <LoadingOutlined style={{ fontSize: fontSize ? fontSize : 50 }} spin />;
    return (<div className={`waiting-container ${className}`}>
        <div className="wrapper">
            {text && <div className="text"> {text}</div>}
            <Spin style={style} indicator={antIcon} className="spinner"></Spin>
        </div>
    </div>)
}