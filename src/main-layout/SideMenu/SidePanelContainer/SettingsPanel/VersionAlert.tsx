import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button } from "antd";
import { LM } from "src/translations/language-manager";
import "./VersionAlert.scss";

interface VersionAlertProps {
    currentVersion: string;
    latestVersion?: string;
}

const RELEASES_URL = 'https://github.com/yaalalabs/fixyl/releases';

export const VersionAlert = ({ currentVersion, latestVersion }: VersionAlertProps) => {
    const getIntlMessage = (msg: string, params?: any) => {
        return LM.getMessage(`version_alert.${msg}`, params);
    }

    const isLatest = (currentVersion: string, latestVersion?: string) => {
        if (!latestVersion) {
            return true;
        }
        return latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) !== 1;
    }

    if (isLatest(currentVersion, latestVersion)) {
        return null;
    }

    return <Alert
        message={getIntlMessage('version_available', { latestVersion })}
        type="info"
        showIcon
        className="version-alert"
        action={<a href={RELEASES_URL} target="_blank" rel="noreferrer">
            <Button size="small" type="text" icon={<DownloadOutlined />} title={getIntlMessage('download')}></Button>
        </a>}
    />
}