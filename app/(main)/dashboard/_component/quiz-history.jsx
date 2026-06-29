"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp } from "lucide-react";

export default function QuizHistory({ assessments }) {
    const [expandedIndustry, setExpandedIndustry] = useState(null);

    if (!assessments || assessments.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Quiz History
                    </CardTitle>
                    <CardDescription>
                        You haven&apos;t taken any quizzes yet. Head over to Interview Prep
                        to get started!
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    // Group assessments by industry/category
    const groupedByIndustry = assessments.reduce((acc, assessment) => {
        const industry = assessment.category;
        if (!acc[industry]) acc[industry] = [];
        acc[industry].push(assessment);
        return acc;
    }, {});

    const industries = Object.keys(groupedByIndustry);

    const toggleIndustry = (industry) => {
        setExpandedIndustry((prev) => (prev === industry ? null : industry));
    };

    const getAverageScore = (list) => {
        const avg = list.reduce((sum, a) => sum + a.quizScore, 0) / list.length;
        return avg.toFixed(1);
    };

    const formatIndustry = (raw) =>
        raw
            .split(/[-/]/)
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Quiz History
                </CardTitle>
                <CardDescription>
                    Your past performance across {industries.length}{" "}
                    {industries.length === 1 ? "industry" : "industries"} — click an
                    industry to see its score chart
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {industries.map((industry) => {
                    const list = groupedByIndustry[industry];
                    const isOpen = expandedIndustry === industry;

                    // Build chart data: oldest first for timeline
                    const chartData = [...list]
                        .reverse()
                        .map((a, i) => ({
                            attempt: `#${i + 1}`,
                            date: format(new Date(a.createdAt), "dd MMM"),
                            score: parseFloat(a.quizScore.toFixed(1)),
                        }));

                    return (
                        <div key={industry} className="border rounded-lg overflow-hidden">
                            {/* Industry summary row — clickable */}
                            <button
                                onClick={() => toggleIndustry(industry)}
                                className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className="space-y-1">
                                    <p className="font-semibold text-base">
                                        {formatIndustry(industry)}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>
                                            {list.length} quiz{list.length > 1 ? "zes" : ""} taken
                                        </span>
                                        <Badge variant="secondary" className="text-xs">
                                            Avg: {getAverageScore(list)}%
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-2xl font-bold">
                                            {getAverageScore(list)}%
                                        </p>
                                        <p className="text-xs text-muted-foreground">Avg Score</p>
                                    </div>
                                    {isOpen ? (
                                        <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                                    )}
                                </div>
                            </button>

                            {/* Expandable score chart + quiz list */}
                            {isOpen && (
                                <div className="px-4 pb-5 pt-2 border-t bg-muted/20">
                                    <p className="text-sm font-medium mb-3 text-muted-foreground">
                                        Score progression over time
                                    </p>
                                    <div className="h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis
                                                    domain={[0, 100]}
                                                    tick={{ fontSize: 12 }}
                                                    unit="%"
                                                />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-background border rounded-lg p-2 shadow-md text-sm">
                                                                    <p className="font-medium">
                                                                        {payload[0].payload.date}
                                                                    </p>
                                                                    <p className="text-primary">
                                                                        Score: {payload[0].value}%
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="score"
                                                    stroke="#36d7b7"
                                                    strokeWidth={2}
                                                    dot={{ r: 4, fill: "#36d7b7" }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Individual quiz entries below chart */}
                                    <div className="mt-4 space-y-2">
                                        {list.map((a) => (
                                            <div
                                                key={a.id}
                                                className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-background border"
                                            >
                                                <span className="text-muted-foreground">
                                                    {format(new Date(a.createdAt), "PPP")}
                                                </span>
                                                <span className="font-medium">
                                                    {a.quizScore.toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
