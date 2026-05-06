
// 2.2 实时分析仪表板指标
// Liquidity & Risk Analytics

export class LiquidityAnalyzer {
    
    /**
     * Calculates the Gini Coefficient to measure pool concentration.
     * 0 = Perfectly distributed, 1 = Perfectly concentrated
     */
    public calculateGiniCoefficient(values: number[]): number {
        if (values.length === 0) return 0;
        
        const sortedValues = [...values].sort((a, b) => a - b);
        const n = sortedValues.length;
        
        // Gini Coefficient formula: (2 * sum(i * x_i) - (n + 1) * sum(x_i)) / (n * sum(x_i))
        let numerator = 0;
        let sumValues = 0;
        
        for (let i = 0; i < n; i++) {
            numerator += (i + 1) * sortedValues[i];
            sumValues += sortedValues[i];
        }
        
        if (sumValues === 0) return 0;
        
        const gini = (2 * numerator) / (n * sumValues) - (n + 1) / n;
        return parseFloat(gini.toFixed(3));
    }

    /**
     * Analyzes market health based on liquidity metrics.
     */
    public analyzeMarketHealth(poolAmounts: Record<string, number>): { status: 'healthy' | 'warning' | 'critical', message: string, gini: number } {
        const pools = Object.values(poolAmounts);
        const gini = this.calculateGiniCoefficient(pools);
        
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        let message = 'Liquidity is balanced.';
        
        if (gini > 0.6) {
            status = 'critical';
            message = 'High concentration risk detected!';
        } else if (gini > 0.4) {
            status = 'warning';
            message = 'Pool distribution is slightly imbalanced.';
        }
        
        return { status, message, gini };
    }
}
