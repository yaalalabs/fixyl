import React, { FC } from 'react';
import { Modal } from 'antd';
import './ModalBox.scss';
import { WaitingOverlay } from '../WaitingOverlay/WaitingOverlay';

export interface ModalBoxProps {
    visible: boolean;
    title?: React.ReactNode;
    closable?: boolean;
    // onOk?(): (e: React.MouseEvent<HTMLElement, MouseEvent>) => void,
    onClose?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
    className?: string;
    width?: string | number;
    loading?: boolean;
    mask?: boolean;
    modalRender?: any;
    getContainer?: any;
    children: any;
}

export const ModalBox: FC<ModalBoxProps> = ({ visible, title, closable, onClose, className, width, loading,
    children, mask, modalRender, getContainer }) => {
    return (
        <Modal visible={visible}
            title={title}
            closable={closable}
            getContainer={getContainer}
            footer={null}
            mask={mask}
            onCancel={onClose}
            className={`modal-box ${className ? className : ''}`}
            maskClosable={false}
            width={width ? width : 520}
            modalRender={modalRender}
            centered
            destroyOnClose>
            {loading ? <WaitingOverlay /> : children}
        </Modal>
    )
}