// Baixa um arquivo gerado no navegador (mesmo padrão do arquivo de projeto).
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // Revogar depois do clique: alguns navegadores leem o blob de forma assíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
