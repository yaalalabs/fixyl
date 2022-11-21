import { DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useState } from "react";
import { Toast } from "src/common/Toast/Toast";
import { GlobalServiceRegistry } from "src/services/GlobalServiceRegistry";
import { LM } from "src/translations/language-manager";
import "./VersionAlert.scss";

const pjson = require('../../../../package.json');

const RELEASES_URL = 'https://github.com/yaalalabs/fixyl/releases';
const TOAST_KEY = '__update__';

export const VersionAlert = () => {
    const currentVersion = pjson.version;
    const [latestVersion] = useState(GlobalServiceRegistry.appManager.getLatestVersion());

    const getIntlMessage = (msg: string, params?: any) => {
        return LM.getMessage(`version_alert.${msg}`, params);
    }

    const notificationBody = <div className="version-alert">
        <span className="message">
            {getIntlMessage('version_available', { latestVersion })}
        </span>

        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="action">
            <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => { Toast.close(TOAST_KEY); }}>{getIntlMessage('download')}</Button>
        </a>

    </div>

    const isLatest = (currentVersion: string, latestVersion?: string) => {
        if (!latestVersion) {
            return true;
        }
        if (GlobalServiceRegistry.appManager.isVersionUpToDate()) {
            return true;
        }
        return latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) !== 1;
    }

    useEffect(() => {
        if (!isLatest(currentVersion, latestVersion)) {
            Toast.info(getIntlMessage('fixyl_update'), notificationBody, 0, TOAST_KEY);
        }
    })

    return null;
}