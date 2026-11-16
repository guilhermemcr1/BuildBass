<?php

namespace App\Models;

use App\Enums\SubmissionStatus;
use App\Support\SearchText;
use Database\Factories\DriverSubmissionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Envio de driver à espera de moderação. O id é o código de protocolo. Valores em
 * SI. `ip_hash` e `contact_email` nunca saem em JSON.
 *
 * @property string $id
 * @property SubmissionStatus $status
 * @property string $brand
 * @property string $model
 * @property string $variant
 * @property string|null $type
 * @property string $source
 * @property string $dedupe_key
 * @property string $ip_hash
 * @property string|null $contact_email
 * @property string $locale
 * @property string|null $rejection_reason
 * @property string|null $decided_by
 * @property Carbon|null $decided_at
 * @property string|null $driver_id
 */
class DriverSubmission extends Model
{
    /** @use HasFactory<DriverSubmissionFactory> */
    use HasFactory;

    use HasUuids;

    /** Campos que descrevem o driver (os mesmos de `drivers`), na ordem do formulário. */
    public const DRIVER_FIELDS = [
        'brand',
        'model',
        'variant',
        'type',
        'nominal_diameter_m',
        'fs_hz',
        'qts',
        'vas_m3',
        'qes',
        'qms',
        're_ohm',
        'le_h',
        'xmax_m',
        'sd_m2',
        'pe_w',
        'bl_tm',
        'mms_kg',
        'vd_m3',
        'source',
    ];

    protected $fillable = [
        ...self::DRIVER_FIELDS,
        'contact_email',
        'locale',
    ];

    protected $hidden = ['ip_hash', 'contact_email', 'dedupe_key'];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'status' => SubmissionStatus::class,
            'nominal_diameter_m' => 'float',
            'fs_hz' => 'float',
            'qts' => 'float',
            'vas_m3' => 'float',
            'qes' => 'float',
            'qms' => 'float',
            're_ohm' => 'float',
            'le_h' => 'float',
            'xmax_m' => 'float',
            'sd_m2' => 'float',
            'pe_w' => 'float',
            'bl_tm' => 'float',
            'mms_kg' => 'float',
            'vd_m3' => 'float',
            'decided_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (DriverSubmission $submission): void {
            $submission->variant ??= '';
            $submission->dedupe_key = SearchText::normalize(
                "{$submission->brand} {$submission->model} {$submission->variant}",
            );
        });
    }

    /**
     * @return BelongsTo<Moderator, $this>
     */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(Moderator::class, 'decided_by');
    }

    /**
     * @return BelongsTo<Driver, $this>
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
