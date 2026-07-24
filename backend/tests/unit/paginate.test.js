import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isPaged, parsePagination, MAX_PAGE_SIZE } = require('../../src/utils/paginate');

describe('paginate.isPaged', () => {
  it('is true only when page/pageSize is present', () => {
    expect(isPaged({})).toBe(false);
    expect(isPaged({ page: '2' })).toBe(true);
    expect(isPaged({ pageSize: '10' })).toBe(true);
  });
});

describe('paginate.parsePagination', () => {
  it('defaults to page 1 with the default size', () => {
    const p = parsePagination({});
    expect(p.page).toBe(1);
    expect(p.offset).toBe(0);
    expect(p.limit).toBe(p.pageSize);
  });

  it('computes offset from page and size', () => {
    const p = parsePagination({ page: '3', pageSize: '20' });
    expect(p.page).toBe(3);
    expect(p.pageSize).toBe(20);
    expect(p.offset).toBe(40);
  });

  it('clamps page to >= 1 and size to <= MAX_PAGE_SIZE', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
    expect(parsePagination({ pageSize: '9999' }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parsePagination({ pageSize: '0' }).pageSize).toBeGreaterThanOrEqual(1);
  });
});
