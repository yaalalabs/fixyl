import React from "react";
import './Toast.scss';
import { Button, notification } from 'antd';
import {
    CheckCircleFilled, InfoCircleFilled, CloseOutlined,
    WarningFilled, CloseCircleFilled
} from '@ant-design/icons';


const getPlacement = (): "topLeft" | "topRight" | "bottomLeft" | "bottomRight" => {
    return 'bottomRight';
}

const notificationsMap: Map<string, number> = new Map();

const getKeyAndCount = (messageHeading: string, messageBody?: any, key?: string) => {
    let notificationKey = key;
    let currentCount = 1;
    if (typeof messageBody === 'string') {
        notificationKey = messageHeading + messageBody;
        currentCount = notificationsMap.get(notificationKey) ?? 1;
        notificationsMap.set(notificationKey, currentCount + 1);
    }
    return {
        notificationKey,
        count: currentCount
    }
}

const onClose = (key: string) => {
    notificationsMap.delete(key);
}

export const NotificationCount = (props: { count: number }) => {
    return <span className="notification-count" title="Notification Count">{props.count}</span>
}
export class Toast {
    static close = (key: string) => {
        notification.close(key);
    }

    static custom = (messageHeading: string, messageBody?: any, className?: string, icon?: any, duration?: number, key?: string) => {
        let description: any = "";
        if (messageBody && (typeof messageBody === "string" || React.isValidElement(messageBody))) {
            description = messageBody;
        }

        notification.info({
            key,
            message: messageHeading,
            description: description,
            icon: icon,
            className: `toast-notification ${className}`,
            duration: duration,
            closeIcon: <Button autoFocus className="toast-close-btn"><CloseOutlined /></Button>,
            placement: getPlacement(),
        });
        console.info(`${messageHeading}: ${messageBody}`);
    }

    static info = (messageHeading: string, messageBody?: any, duration?: number, key?: string) => {
        let description: any = "";
        if (messageBody && (typeof messageBody === "string" || React.isValidElement(messageBody))) {
            description = messageBody;
        }
        let { notificationKey, count } = getKeyAndCount(messageHeading, messageBody, key);

        notification.info({
            key: notificationKey,
            message: count < 2 ? messageHeading : <span><NotificationCount count={count} />{messageHeading}</span>,
            description: description,
            icon: <InfoCircleFilled />,
            className: 'toast-notification toast-info',
            duration: duration,
            closeIcon: <Button autoFocus className="toast-close-btn"><CloseOutlined /></Button>,
            placement: getPlacement(),
            onClose: () => notificationKey ? onClose(notificationKey) : undefined
        });
        console.info(`${messageHeading}: ${messageBody}`);
    }

    static success = (messageHeading: string, messageBody?: any, duration?: number, key?: string) => {
        let description: any = "";
        if (messageBody && (typeof messageBody === "string" || React.isValidElement(messageBody))) {
            description = messageBody;
        }
        let { notificationKey, count } = getKeyAndCount(messageHeading, messageBody, key);

        notification.success({
            key: notificationKey,
            message: count < 2 ? messageHeading : <span><NotificationCount count={count} />{messageHeading}</span>,
            description: description,
            icon: <CheckCircleFilled />,
            className: 'toast-notification toast-success',
            duration: duration,
            closeIcon: <Button autoFocus className="toast-close-btn"><CloseOutlined /></Button>,
            placement: getPlacement(),
            onClose: () => notificationKey ? onClose(notificationKey) : undefined
        });
        console.log(`${messageHeading}: ${messageBody}`);
    }

    static warn = (messageHeading: string, messageBody?: any, duration?: number, key?: string) => {
        let description: any = "";
        if (messageBody && (typeof messageBody === "string" || React.isValidElement(messageBody))) {
            description = messageBody;
        }
        let { notificationKey, count } = getKeyAndCount(messageHeading, messageBody, key);

        notification.warn({
            key: notificationKey,
            message: count < 2 ? messageHeading : <span><NotificationCount count={count} />{messageHeading}</span>,
            description: description,
            icon: <WarningFilled />,
            className: 'toast-notification toast-warn',
            duration: duration,
            closeIcon: <Button autoFocus className="toast-close-btn"><CloseOutlined /></Button>,
            placement: getPlacement(),
            onClose: () => notificationKey ? onClose(notificationKey) : undefined
        });
        console.warn(`${messageHeading}: ${messageBody}`);
    }

    static error = (messageHeading: string, messageBody?: any, duration?: number, key?: string) => {
        let description: any = "";
        if (messageBody && (typeof messageBody === "string" || React.isValidElement(messageBody))) {
            description = messageBody;
        }
        let { notificationKey, count } = getKeyAndCount(messageHeading, messageBody, key);

        notification.error({
            key: notificationKey,
            message: count < 2 ? messageHeading : <span><NotificationCount count={count} />{messageHeading}</span>,
            description: description,
            icon: <CloseCircleFilled />,
            className: 'toast-notification toast-error',
            duration: duration,
            closeIcon: <Button autoFocus className="toast-close-btn"><CloseOutlined /></Button>,
            placement: getPlacement(),
            onClose: () => notificationKey ? onClose(notificationKey) : undefined
        });
        console.error(`${messageHeading}: ${messageBody}`);
    }
}