'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface VideoTrend {
  date: string;
  count: number;
}

interface VideoChartProps {
  data: VideoTrend[];
}

export function VideoChart({ data }: VideoChartProps) {
  // Format data for the chart
  const chartData = data.map((item) => {
    try {
      return {
        ...item,
        formattedDate: format(parseISO(item.date), 'MMM dd'),
      };
    } catch (error) {
      // If date parsing fails, use the original date string
      return {
        ...item,
        formattedDate: item.date,
      };
    }
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="formattedDate"
          tick={{ fontSize: 12 }}
          stroke="#6b7280"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#6b7280"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '0.5rem',
          }}
          labelStyle={{ fontWeight: 'bold', marginBottom: '0.25rem' }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
