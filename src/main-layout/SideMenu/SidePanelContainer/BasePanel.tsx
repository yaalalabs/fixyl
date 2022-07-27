import React, { FC } from 'react';
import "./BasePanel.scss";

interface BasePanelProps {
    className?: string;
    style?: any;
    title: any;
    subTitle?: string;
}

export const BasePanel: FC<BasePanelProps> = ({ children, style, className, title, subTitle }) => {
    return (<div className={`base-panel vivify fadeIn ${className ?? ""}`} style={style}>
        <div className="base-panel-header">
            <div className="title"> {title} </div>
            <div className="sub-title"> {subTitle} </div>
        </div>
        <div className="base-panel-body">
            {children}
        </div>
    </div>)
}
