import { Empty } from "antd";
import { useEffect, useState } from "react";
import { FixServerSession } from "src/services/fix/FixServerSession";
import { BaseClientFixSession, ServerSideFixClientSession } from "src/services/fix/FixSession";
import { LM } from "src/translations/language-manager";
import "./ServerSideClientList.scss"

const getIntlMessage = (msg: string, opt?: any) => {
    return LM.getMessage(`server.${msg}`, opt);
}

interface ServerSideClientListProps {
    serverSession: FixServerSession;
    currentClientSession?: BaseClientFixSession;
    onClientSelected: (client: ServerSideFixClientSession) => void;
}

export const ServerSideClientList: React.FC<ServerSideClientListProps> = ({ serverSession, currentClientSession, onClientSelected }) => {
    const [clients, setClients] = useState<ServerSideFixClientSession[]>(serverSession.getClients())

    useEffect(() => {
        const sub = serverSession.getUpdateObservable().subscribe(() => {
            setClients(serverSession.getClients())
        })
        return () => {
            sub.unsubscribe();
        }
    }, [serverSession])

    return <div className="server-side-client-list-wrapper">
        <div className="header">
            {getIntlMessage("ssc_list_title")}
        </div>
        <div className="server-side-client-list">
            {clients.length > 0 && clients.map(client => <div className={`client ${currentClientSession === client ? "selected" : ""}`} onClick={() => onClientSelected(client)}>
                SSC_{client.getSocket()?.id}
            </div>)}
            {clients.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={getIntlMessage("no_clients")} />}

        </div>
    </div>
}