interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span>{`Page ${page} of ${pageCount}`}</span>
      <button type="button" className="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
        Next
      </button>
    </nav>
  );
}