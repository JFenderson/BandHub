'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BandData {
  id: string;
  name: string;
  videoCount: number;
  schoolName: string;
}

interface BandBarChartProps {
  data: BandData[];
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function BandBarChart({ data }: BandBarChartProps) {
  // Format data for the chart
  const chartData = data.map((item) => ({
    name: item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name,
    fullName: item.name,
    videos: item.videoCount,
    school: item.schoolName,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6b7280" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          stroke="#6b7280"
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '0.5rem',
          }}
          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                  <p className="font-bold text-gray-900">{payload[0].payload.fullName}</p>
                  <p className="text-sm text-gray-600">{payload[0].payload.school}</p>
                  <p className="text-sm font-semibold text-blue-600 mt-1">
                    Videos: {payload[0].value}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="videos" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
