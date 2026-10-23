{{--
    Aviso de alterações não salvas em Dialog do Filament, no lugar do popup nativo do navegador.
    Qualquer clique em link (Cancelar, menu lateral, migalhas) com o formulário alterado abre o
    Dialog; "Descartar e sair" segue o link. O popup nativo só sobra ao fechar ou recarregar a aba,
    que o navegador não deixa trocar. "Alterado" usa o mesmo critério do Filament (hash dos dados
    contra o último estado salvo), então salvar sem sair zera o aviso.
--}}
<script>
    window.unsavedGuard = () => ({
        url: null,

        form() {
            return (window.Livewire?.all() ?? []).find(
                (component) =>
                    component.ephemeral?.data !== undefined &&
                    component.ephemeral?.savedDataHash !== undefined,
            )
        },

        hash(component) {
            return window.jsMd5(JSON.stringify(component.$wire.data).replace(/\\/g, ''))
        },

        dirty() {
            const component = this.form()

            if (!component || component.effects?.redirect) {
                return false
            }

            return component.$wire.savedDataHash && this.hash(component) !== component.$wire.savedDataHash
        },

        intercept(event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return
            }

            const link = event.target.closest?.('a[href]')

            if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) {
                return
            }

            const href = link.getAttribute('href')

            if (!href || href.startsWith('#') || href.startsWith('javascript:') || !this.dirty()) {
                return
            }

            event.preventDefault()
            event.stopImmediatePropagation()
            this.url = link.href
            this.$dispatch('open-modal', { id: 'unsaved-guard' })
        },

        leave() {
            const component = this.form()

            // Marca o estado atual como "salvo" para o aviso nativo não aparecer em seguida.
            if (component) {
                component.$wire.savedDataHash = this.hash(component)
            }

            window.location.href = this.url
        },
    })
</script>

<div x-data="unsavedGuard()" x-on:click.window.capture="intercept($event)">
    <x-filament::modal
        id="unsaved-guard"
        width="md"
        alignment="center"
        icon="heroicon-o-exclamation-triangle"
        icon-color="warning"
        :close-by-clicking-away="false"
    >
        <x-slot name="heading">Descartar as alterações?</x-slot>
        <x-slot name="description">O que você preencheu e ainda não salvou será perdido.</x-slot>
        <x-slot name="footer">
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap">
                <x-filament::button color="gray" x-on:click="$dispatch('close-modal', { id: 'unsaved-guard' })">
                    Continuar editando
                </x-filament::button>
                <x-filament::button color="danger" x-on:click="leave()">
                    Descartar e sair
                </x-filament::button>
            </div>
        </x-slot>
    </x-filament::modal>
</div>
