<?php

// Auditoria do painel: por quanto tempo os eventos ficam guardados. A rotina
// `audit:prune` apaga o que passar do prazo.
return [

    'retention_days' => (int) env('AUDIT_RETENTION_DAYS', 180),

];
