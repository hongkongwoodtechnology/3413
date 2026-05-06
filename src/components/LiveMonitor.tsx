
import { Activity, AlertTriangle, CheckCircle, Server, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

interface MonitorMetrics {
    latency: number;
    activeConnections: number;
    eventsPerSecond: number;
    lastUpdate: number;
    status: 'healthy' | 'degraded' | 'critical';
}

export function LiveMonitor({ totalMatches }: { totalMatches: number }) {
    const [metrics, setMetrics] = useState<MonitorMetrics>({
        latency: 45,
        activeConnections: 1240,
        eventsPerSecond: 12,
        lastUpdate: Date.now(),
        status: 'healthy'
    });

    const [history, setHistory] = useState<number[]>(new Array(20).fill(20));

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            // In a real app, these would come from your monitoring service
            const newLatency = Math.floor(Math.random() * 30) + 30; 
            const newEvents = Math.floor(Math.random() * 5) + 10;
            
            setMetrics(prev => ({
                latency: newLatency,
                activeConnections: prev.activeConnections + Math.floor(Math.random() * 10) - 5,
                eventsPerSecond: newEvents,
                lastUpdate: now,
                status: newLatency > 300 ? 'critical' : newLatency > 100 ? 'degraded' : 'healthy'
            }));

            setHistory(prev => [...prev.slice(1), newLatency]);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none transition-opacity">
            {/* Main Dashboard Card */}
            <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 p-4 rounded-xl shadow-2xl w-72 pointer-events-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary-purple" />
                        <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">System Status</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        metrics.status === 'healthy' ? 'bg-success/20 text-success' : 
                        metrics.status === 'degraded' ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            metrics.status === 'healthy' ? 'bg-success animate-pulse' : 
                            metrics.status === 'degraded' ? 'bg-warning' : 'bg-error'
                        }`} />
                        {metrics.status.toUpperCase()}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-neutral-800/50 p-2 rounded-lg">
                        <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                            <Wifi className="h-3 w-3" /> Latency
                        </div>
                        <div className={`text-lg font-mono font-bold ${metrics.latency > 100 ? 'text-error' : 'text-white'}`}>
                            {metrics.latency}ms
                        </div>
                    </div>
                    <div className="bg-neutral-800/50 p-2 rounded-lg">
                        <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                            <Activity className="h-3 w-3" /> TPS
                        </div>
                        <div className="text-lg font-mono font-bold text-white">{metrics.eventsPerSecond}</div>
                    </div>
                </div>

                {/* Simulated Chart */}
                <div className="flex items-end gap-0.5 h-8 w-full overflow-hidden mb-3">
                    {history.map((h, i) => (
                        <div 
                            key={i} 
                            className={`flex-1 transition-colors rounded-t-sm ${
                                h > 300 ? 'bg-error' : h > 100 ? 'bg-warning' : 'bg-primary-purple/50'
                            }`}
                            style={{ height: `${Math.min((h / 400) * 100, 100)}%` }}
                        />
                    ))}
                </div>
                
                <div className="mt-2 text-[10px] text-neutral-600 flex justify-between items-center">
                    <span>Sync: 99.9%</span>
                    <span>Nodes: 12/12</span>
                </div>
            </div>
        </div>
    );
}
