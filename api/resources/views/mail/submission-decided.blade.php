<x-mail::message>
# {{ $heading }}

{{ $intro }}

@if ($reasonLabel !== null)
{{ $reasonLabel }}

<x-mail::panel>
{{ $reason }}
</x-mail::panel>
@endif

{{ $outro }}

{{ $protocol }}
</x-mail::message>
