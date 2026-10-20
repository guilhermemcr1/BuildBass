import { expect, test } from 'vite-plus/test';
import { apiUrl } from './api';

test('monta a URL da API sem barras duplicadas', () => {
    expect(apiUrl('/up', 'http://localhost:8000/')).toBe(
        'http://localhost:8000/up',
    );
    expect(apiUrl('api/drivers', 'http://localhost:8000')).toBe(
        'http://localhost:8000/api/drivers',
    );
});
