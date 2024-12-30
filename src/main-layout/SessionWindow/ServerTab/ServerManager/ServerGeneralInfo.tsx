import { FixServerSession } from "src/services/fix/FixServerSession"
import "./ServerGeneralInfo.scss"
import { LM } from "src/translations/language-manager";
import { useEffect, useState } from "react";


const getIntlMessage = (msg: string) => {
    return LM.getMessage(`server.${msg}`);
}

interface ServerGeneralInfoProps {
    session: FixServerSession;
}

const getFieldValue = (field: string, value: any) => {
    return <div className="field-container">
        <div className="field-name">{field}</div>
        <div className="field-value">{value}</div>
    </div>
}

export const ServerGeneralInfo: React.FC<ServerGeneralInfoProps> = ({ session }) => {
    const { name, port, senderCompId, targetCompId,  } = session.profile;

    const [connected, setConnected] = useState(session.isLive())

    useEffect(() => {
        const sub = session.getUpdateObservable().subscribe(() => {
            setConnected(session.isLive())
        })
        return () => sub.unsubscribe()
    }, [session])

    return <div className="server-general-info">
        {getFieldValue(getIntlMessage("name"), name)}
        {getFieldValue(getIntlMessage("port"), port)}
        {getFieldValue(getIntlMessage("sender_comp_id"), senderCompId)}
        {getFieldValue(getIntlMessage("target_comp_id"), targetCompId)}
        {getFieldValue(getIntlMessage("connected_time"), session.getConnectedTime())}
        {getFieldValue(getIntlMessage("state"), connected ? <div className="connected">{getIntlMessage("listening")}</div> :
            <div className="disconnected">{getIntlMessage("stopped")}</div>)}
    </div>
}