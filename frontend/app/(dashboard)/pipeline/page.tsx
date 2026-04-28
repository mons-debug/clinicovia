"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Filter,
  DollarSign,
  Flame,
  Thermometer,
  Snowflake,
  Loader2,
  AlertCircle,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/constants";
import {
  useDeals,
  useMoveDealStage,
  type DealResponse,
} from "@/lib/api/deals";

const tempConfig = {
  hot: { icon: Flame, color: "text-red-500", bg: "bg-red-50" },
  warm: { icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50" },
  cold: { icon: Snowflake, color: "text-blue-400", bg: "bg-blue-50" },
};

export default function PipelinePage() {
  const { data, isLoading, isError, error } = useDeals({ include_closed: true });
  const moveMutation = useMoveDealStage();

  // Local optimistic state for drag-and-drop
  const [optimisticDeals, setOptimisticDeals] = useState<Record<string, DealResponse[]> | null>(null);
  const snapshotRef = useRef<Record<string, DealResponse[]> | null>(null);

  // Group deals by stage from API data or optimistic state
  const groupedDeals: Record<string, DealResponse[]> = optimisticDeals ?? (() => {
    const grouped: Record<string, DealResponse[]> = {};
    DEFAULT_PIPELINE_STAGES.forEach((s) => (grouped[s] = []));
    if (data?.deals) {
      data.deals.forEach((deal) => {
        if (!grouped[deal.pipeline_stage]) grouped[deal.pipeline_stage] = [];
        grouped[deal.pipeline_stage].push(deal);
      });
    }
    return grouped;
  })();

  const totalValue = data?.summary?.total_value ?? 0;
  const totalDeals = data?.summary?.total_deals ?? 0;

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      // Same stage reorder — no API call needed
      if (source.droppableId === destination.droppableId) return;

      // Optimistic update
      const currentGrouped: Record<string, DealResponse[]> = {};
      DEFAULT_PIPELINE_STAGES.forEach((s) => {
        currentGrouped[s] = [...(groupedDeals[s] || [])];
      });

      // Save snapshot for rollback
      snapshotRef.current = { ...currentGrouped };
      Object.keys(snapshotRef.current).forEach((k) => {
        snapshotRef.current![k] = [...currentGrouped[k]];
      });

      const sourceCol = currentGrouped[source.droppableId];
      const destCol = currentGrouped[destination.droppableId];
      const [moved] = sourceCol.splice(source.index, 1);
      moved.pipeline_stage = destination.droppableId;
      destCol.splice(destination.index, 0, moved);

      setOptimisticDeals(currentGrouped);

      // Call API
      moveMutation.mutate(
        { id: draggableId, stage: destination.droppableId },
        {
          onSuccess: () => {
            setOptimisticDeals(null); // Clear optimistic state, let React Query refetch
          },
          onError: () => {
            // Rollback
            setOptimisticDeals(null);
            toast.error("Failed to move deal. Reverted.");
          },
        }
      );
    },
    [groupedDeals, moveMutation]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-secondary">Loading pipeline...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : "Failed to load pipeline"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pipeline</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {totalDeals} deals &middot; AED {totalValue.toLocaleString()} total value
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pipeline/deals/new"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            <Plus className="h-4 w-4" />
            Add Deal
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {totalDeals === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <DollarSign className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-3 text-sm font-medium text-text-primary">No deals yet</p>
            <p className="mt-1 text-xs text-text-secondary">
              Start by adding your first deal to the pipeline.
            </p>
            <Link
              href="/pipeline/deals/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              <Plus className="h-4 w-4" />
              Add First Deal
            </Link>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {totalDeals > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {DEFAULT_PIPELINE_STAGES.map((stage) => {
              const stageDeals = groupedDeals[stage] || [];
              const stageSummary = data?.summary?.by_stage?.[stage];
              const stageValue = stageSummary?.value ?? stageDeals.reduce((s, d) => s + d.value, 0);

              return (
                <div key={stage} className="flex w-[280px] shrink-0 flex-col">
                  {/* Column header */}
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {stage}
                      </h3>
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-text-secondary shadow-sm">
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageValue > 0 && (
                      <span className="text-[10px] font-medium text-text-muted">
                        AED {stageValue.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={stage}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${
                          snapshot.isDraggingOver ? "bg-primary-lighter/20" : ""
                        }`}
                        style={{ minHeight: 60 }}
                      >
                        {stageDeals.map((deal, index) => {
                          const temp = tempConfig[deal.temperature] || tempConfig.warm;
                          const TempIcon = temp.icon;
                          const initials = deal.patient_name
                            ? deal.patient_name
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)
                            : "??";

                          return (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
                                    deal.is_won
                                      ? "border-emerald-200 bg-emerald-50/50"
                                      : deal.is_lost
                                        ? "border-red-200 bg-red-50/30 opacity-60"
                                        : snapshot.isDragging
                                          ? "border-primary-light shadow-md"
                                          : "border-border hover:shadow-md"
                                  }`}
                                >
                                  {/* Won/Lost badge */}
                                  {deal.is_won && (
                                    <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                                      <Trophy className="h-3 w-3" /> Won
                                    </div>
                                  )}
                                  {deal.is_lost && (
                                    <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-red-600">
                                      <XCircle className="h-3 w-3" /> Lost
                                    </div>
                                  )}

                                  {/* Card top */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                        style={{ backgroundColor: "#0D4F6C" }}
                                      >
                                        {initials}
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-text-primary">
                                          {deal.patient_name || "Unknown Patient"}
                                        </p>
                                        <p className="text-[10px] text-text-muted">
                                          {deal.treatment || deal.title}
                                        </p>
                                      </div>
                                    </div>
                                    <div className={`rounded-md p-1 ${temp.bg}`}>
                                      <TempIcon className={`h-3 w-3 ${temp.color}`} />
                                    </div>
                                  </div>

                                  {/* Value */}
                                  <div className="mt-2.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-sm font-bold text-text-primary">
                                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                      {deal.value.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-text-muted">
                                      {deal.days_in_stage}d in stage
                                    </span>
                                  </div>

                                  {/* Footer */}
                                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                                    <span className="text-[10px] text-text-muted">
                                      {deal.currency}
                                    </span>
                                    <Link
                                      href={`/pipeline/deals/${deal.id}`}
                                      className="text-[10px] font-medium transition-opacity hover:opacity-70"
                                      style={{ color: "var(--primary-light)" }}
                                    >
                                      View
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
