import React, { useEffect, useState } from 'react';
import './LoadingScreen.scss';
import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';

export const LoadingScreen: React.FC<any> = props => {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setLoading(true);
        }, 1000);
    }, [])

    return (<div className="loading-container">
        <div className="wrapper">
            <img src={require('../../assets/loading.png').default} alt="Logo" />
            {loading && <Spin className="spinner" indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />}
        </div>
    </div>);
};
