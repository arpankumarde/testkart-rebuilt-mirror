import React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from './Chart';
import styles from './EarningsChart.module.css';

interface EarningsData {
  month: string;
  earnings: number;
}

interface EarningsChartProps {
  data: EarningsData[];
  className?: string;
}

const chartConfig: ChartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(260, 75%, 65%)',
  },
};

export const EarningsChart: React.FC<EarningsChartProps> = ({ data, className }) => {
  const totalEarnings = data.reduce((acc, item) => acc + item.earnings, 0);
  const lastMonthEarnings = data.length > 0 ? data[data.length - 1].earnings : 0;
  const lastWeekEarnings = lastMonthEarnings / 4; // Placeholder calculation

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.statsHeader}>
        <div className={styles.statItem}>
          <h3 className={styles.statTitle}>Total Earnings</h3>
          <p className={styles.statValue}>{formatCurrency(totalEarnings)}</p>
        </div>
        <div className={styles.statItem}>
          <h3 className={styles.statTitle}>Last Month</h3>
          <p className={styles.statValue}>{formatCurrency(lastMonthEarnings)}</p>
        </div>
        <div className={styles.statItem}>
          <h3 className={styles.statTitle}>Last Week</h3>
          <p className={styles.statValue}>{formatCurrency(lastWeekEarnings)}</p>
        </div>
      </div>
      <div className={styles.chartWrapper}>
        <ChartContainer config={chartConfig}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-5)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-color-5)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `₹${Number(value) / 1000}k`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="var(--color-earnings)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEarnings)"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
};