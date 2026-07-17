"use client";

import { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import type { EngineDiagnostics } from "@/domain/eoe";

export function DeveloperPanel({ diagnostics }: { diagnostics?: EngineDiagnostics }) {
  const [open, setOpen] = useState(true);
  return (
    <aside
      data-testid="developer-panel"
      className="absolute bottom-24 right-3 z-30 w-[min(360px,calc(100%-24px))] overflow-hidden rounded-2xl border border-[#cad3d5] bg-[#17252a]/95 text-white shadow-2xl backdrop-blur md:bottom-28"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold"
        onClick={() => setOpen((value) => !value)}
      >
        <Bug size={14} /> EOE Developer
        <span className="ml-auto">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
      </button>
      {open ? (
        <div className="max-h-[48dvh] overflow-y-auto border-t border-white/10 px-3 py-3 font-mono text-[10px] leading-5 text-[#dbe5e3]">
          {diagnostics ? (
            <dl className="grid grid-cols-[120px_1fr] gap-x-2">
              <dt>Function</dt><dd>{diagnostics.analysis.primaryFunction}</dd>
              <dt>Obligations</dt><dd className="break-all">{diagnostics.responseObligations.map((item) => item.kind).join(", ") || "none"}</dd>
              <dt>Task complete</dt><dd>{String(diagnostics.taskCompleteness.complete)}</dd>
              <dt>Missing</dt><dd className="break-all">{diagnostics.taskCompleteness.missingObligationIds.join(", ") || "none"}</dd>
              <dt>Fixed / Effective</dt><dd>{diagnostics.decision.fixedLevel} / {diagnostics.decision.effectiveLevel}</dd>
              <dt>Overlay</dt><dd>{diagnostics.decision.mode}</dd>
              <dt>Candidates</dt><dd className="break-all">{diagnostics.selection.candidates.map((item) => item.phraseId).join(", ") || "none"}</dd>
              <dt>Selected</dt><dd>{diagnostics.selection.selectedPhraseId ?? "none"}</dd>
              <dt>noFit</dt><dd>{String(diagnostics.noFit)}</dd>
              <dt>noFit source</dt><dd>{diagnostics.noFitDecisionSource ?? "n/a"}</dd>
              <dt>noFit reason</dt><dd>{diagnostics.noFitReason ?? "n/a"}</dd>
              <dt>User English reuse</dt><dd>{String(diagnostics.userEnglishReuseOpportunity)}</dd>
              <dt>Reuse opportunity</dt><dd className="break-all">{diagnostics.userPhraseReuseOpportunity ? `${diagnostics.userPhraseReuseOpportunity.phraseId} / ${diagnostics.userPhraseReuseOpportunity.source} / ${diagnostics.userPhraseReuseOpportunity.matchedText}` : "none"}</dd>
              <dt>Realized position</dt><dd>{diagnostics.realizedPhrasePosition ?? "none"}</dd>
              <dt>Realization profile</dt><dd className="break-all">{diagnostics.phraseRealizationProfile ? `${diagnostics.phraseRealizationProfile.phraseId} / taskRisk=${diagnostics.phraseRealizationProfile.taskReplacementRisk}` : "none"}</dd>
              <dt>Assistance source</dt><dd>{diagnostics.assistance?.sourceMessageId ?? "none"}</dd>
              <dt>Assistance v2</dt><dd>{diagnostics.assistance?.contextVersion ?? "none"}</dd>
              <dt>Assistance fallback</dt><dd>{String(diagnostics.assistance?.assistanceContentFallback ?? false)}</dd>
              <dt>Observation</dt><dd>{diagnostics.visionObservation ? `${diagnostics.visionObservation.valid ? "valid" : "invalid"} / ${diagnostics.visionObservation.providerId}` : "none"}</dd>
              <dt>Visible evidence</dt><dd className="break-all">{diagnostics.visionObservation?.envelope?.observations.map((item) => item.description).join("; ") || "none"}</dd>
              <dt>Visible text</dt><dd className="break-all">{diagnostics.visionObservation?.envelope?.visibleText.join(", ") || "none"}</dd>
              <dt>Uncertainty</dt><dd className="break-all">{diagnostics.visionObservation?.envelope?.uncertainties.join("; ") || "none"}</dd>
              <dt>Benchmark</dt><dd>{diagnostics.benchmarkType}</dd>
              <dt>Evidence</dt><dd>{diagnostics.naturalnessEvidence}</dd>
              <dt>Provider</dt><dd>{diagnostics.providerId} / {diagnostics.modelId}</dd>
              <dt>Attempts</dt><dd>{diagnostics.attempts.length}</dd>
              <dt>Pipeline stage</dt><dd className="break-all">{diagnostics.attempts.map((attempt) => `A${attempt.attemptNumber}:${attempt.pipelineStage ?? "legacy"}`).join(", ")}</dd>
              <dt>Template parse</dt><dd>{diagnostics.attempts.map((attempt) => `A${attempt.attemptNumber}:${attempt.pipeline?.templateParse ?? "n/a"}`).join(", ")}</dd>
              <dt>Template validator</dt><dd>{diagnostics.attempts.map((attempt) => `A${attempt.attemptNumber}:${attempt.pipeline?.templateValidator ?? "n/a"}`).join(", ")}</dd>
              <dt>Mapper / Schema</dt><dd>{diagnostics.attempts.map((attempt) => `A${attempt.attemptNumber}:${attempt.pipeline?.mapper ?? "n/a"}/${attempt.pipeline?.domainSchema ?? "n/a"}`).join(", ")}</dd>
              <dt>Domain validator</dt><dd>{diagnostics.attempts.map((attempt) => `A${attempt.attemptNumber}:${attempt.pipeline?.domainValidator ?? "n/a"}`).join(", ")}</dd>
              <dt>Validator</dt><dd>{diagnostics.finalValidation.valid ? "valid" : "invalid"}</dd>
              <dt>Violations</dt><dd className="break-all">{diagnostics.attempts.flatMap((attempt) => attempt.validation.violations.map((item) => item.code)).join(", ") || "none"}</dd>
              <dt>Pipeline errors</dt><dd className="break-all">{diagnostics.attempts.flatMap((attempt) => attempt.pipelineDiagnostics?.map((item) => item.code) ?? []).join(", ") || "none"}</dd>
              <dt>Naturalness</dt><dd>{diagnostics.naturalness ? `${diagnostics.naturalness.suggestedAction} / ${diagnostics.naturalness.confidence}` : "not triggered"}</dd>
              <dt>Natural issues</dt><dd className="break-all">{diagnostics.naturalness?.issues.join(", ") || "none"}</dd>
              <dt>Natural triggers</dt><dd className="break-all">{diagnostics.naturalness?.triggers.join(", ") || "none"}</dd>
              <dt>Soft quality</dt><dd>{diagnostics.softQualityReview ? `${diagnostics.softQualityReview.acceptable ? "acceptable" : "warning"} / ${diagnostics.softQualityReview.confidence}` : "not triggered"}</dd>
              <dt>Soft warnings</dt><dd className="break-all">{diagnostics.softQualityReview?.warnings.join(", ") || "none"}</dd>
              <dt>Displayed w/ warning</dt><dd>{String(diagnostics.displayedWithSoftQualityWarning ?? false)}</dd>
              <dt>Overlay preference</dt><dd>{diagnostics.temporaryOverlayPreference ? `${diagnostics.temporaryOverlayPreference.mode} / ${diagnostics.temporaryOverlayPreference.reason}` : "normal"}</dd>
              <dt>Context ack</dt><dd>{String(diagnostics.contextualAcknowledgement?.active ?? false)}</dd>
              <dt>Latency</dt><dd>{diagnostics.totalLatencyMs} ms</dd>
              <dt>Token usage</dt><dd>{diagnostics.totalUsage?.totalTokens ?? "n/a"}</dd>
              <dt>Fallback</dt><dd>provider={String(diagnostics.fallbackUsed)}, natural={String(diagnostics.naturalFallbackUsed)}</dd>
              <dt>Policy</dt><dd>{diagnostics.policyVersion}</dd>
              <dt>Registry</dt><dd>{diagnostics.registryVersion}</dd>
              <dt>Template schema</dt><dd>{diagnostics.providerTemplateSchemaVersion}</dd>
              <dt>Realization</dt><dd>{diagnostics.realizationPolicyVersion}</dd>
              <dt>Template validator</dt><dd>{diagnostics.templateValidatorVersion}</dd>
            </dl>
          ) : (
            <p>发送一条消息后显示本轮诊断。</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
