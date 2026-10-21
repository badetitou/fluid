{{/*
Chart name (respecting nameOverride).
*/}}
{{- define "fluid.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified release name.
*/}}
{{- define "fluid.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* Per-component resource names. */}}
{{- define "fluid.frontend.fullname" -}}{{ include "fluid.fullname" . }}-frontend{{- end -}}
{{- define "fluid.bff.fullname" -}}{{ include "fluid.fullname" . }}-bff{{- end -}}
{{- define "fluid.postgres.fullname" -}}{{ include "fluid.fullname" . }}-postgres{{- end -}}
{{- define "fluid.db.secretName" -}}{{ include "fluid.fullname" . }}-db{{- end -}}
{{- define "fluid.llm.secretName" -}}{{ include "fluid.fullname" . }}-llm{{- end -}}

{{/*
Common labels.
*/}}
{{- define "fluid.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "fluid.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{/*
Component selector labels. Call with (list $root "component").
*/}}
{{- define "fluid.selectorLabels" -}}
{{- $root := index . 0 -}}
{{- $component := index . 1 -}}
app.kubernetes.io/name: {{ include "fluid.name" $root }}
app.kubernetes.io/instance: {{ $root.Release.Name }}
app.kubernetes.io/component: {{ $component }}
{{- end -}}

{{/*
Build a fully-qualified image reference. Call with (list $root $componentImage).
Resolution: componentImage.registry|tag override global image.registry|tag,
tag falls back to the chart appVersion.
*/}}
{{- define "fluid.image" -}}
{{- $root := index . 0 -}}
{{- $img := index . 1 -}}
{{- $registry := default $root.Values.image.registry $img.registry -}}
{{- $tag := default (default $root.Chart.AppVersion $root.Values.image.tag) $img.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $img.repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $img.repository $tag -}}
{{- end -}}
{{- end -}}

{{/*
Database host resolution (bundled postgres vs external).
*/}}
{{- define "fluid.db.host" -}}
{{- if .Values.postgres.enabled -}}
{{ include "fluid.postgres.fullname" . }}
{{- else -}}
{{ required "externalDatabase.host is required when postgres.enabled=false" .Values.externalDatabase.host }}
{{- end -}}
{{- end -}}

{{- define "fluid.db.port" -}}
{{- if .Values.postgres.enabled -}}{{ .Values.postgres.service.port }}{{- else -}}{{ .Values.externalDatabase.port }}{{- end -}}
{{- end -}}

{{- define "fluid.db.user" -}}
{{- if .Values.postgres.enabled -}}{{ .Values.postgres.auth.username }}{{- else -}}{{ .Values.externalDatabase.username }}{{- end -}}
{{- end -}}

{{- define "fluid.db.password" -}}
{{- if .Values.postgres.enabled -}}{{ .Values.postgres.auth.password }}{{- else -}}{{ .Values.externalDatabase.password }}{{- end -}}
{{- end -}}

{{- define "fluid.db.name" -}}
{{- if .Values.postgres.enabled -}}{{ .Values.postgres.auth.database }}{{- else -}}{{ .Values.externalDatabase.database }}{{- end -}}
{{- end -}}

{{/*
Build a Prisma-compatible DATABASE_URL for a given schema. Call with (list $root "schema").
*/}}
{{- define "fluid.db.url" -}}
{{- $root := index . 0 -}}
{{- $schema := index . 1 -}}
{{- printf "postgresql://%s:%s@%s:%s/%s?schema=%s" (include "fluid.db.user" $root) (include "fluid.db.password" $root) (include "fluid.db.host" $root) (include "fluid.db.port" $root) (include "fluid.db.name" $root) $schema -}}
{{- end -}}
