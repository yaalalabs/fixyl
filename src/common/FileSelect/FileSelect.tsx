import { Button, Input } from "antd";
import React from "react";
import { CommonServiceFactory } from "src/services/CommonServiceFactory";
import "./FileSelect.scss";

interface FileSelectProps {
    onChange?: (path: any) => void;
    label: string;
    value?: string;
    options?: any;
}

export const FileSelect = ({ onChange, label, value, options }: FileSelectProps) => {

    const handleClick = () => {
        CommonServiceFactory.instance.createNewFileManagementService().selectFile(options ?? ['openFile']).then((data) => {
            onChange?.(data?.path);
        })
    }

    return (
        <div className="file-select-container">
            <Input disabled value={value} addonBefore={<Button className="" onClick={handleClick}>{label}</Button>} />
        </div>
    );
}