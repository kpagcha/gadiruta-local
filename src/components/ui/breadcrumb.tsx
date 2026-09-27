import { ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';

/** Mark a short trail of links as page navigation. */
export function Breadcrumb(props: ComponentProps<'nav'>) {
  return <nav {...props} />;
}

/** Let long place names wrap without losing the order of the trail. */
export function BreadcrumbList(props: ComponentProps<'ol'>) {
  return <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted" {...props} />;
}

/** Keep each link or current page with its own separator. */
export function BreadcrumbItem(props: ComponentProps<'li'>) {
  return <li className="inline-flex items-center gap-1.5" {...props} />;
}

/** Show a parent page as a navigable breadcrumb. */
export function BreadcrumbLink(props: ComponentProps<'a'>) {
  return (
    <a className="text-accent underline decoration-line-decoration underline-offset-4 hover:text-ink" {...props} />
  );
}

/** Mark the current place at the end of the breadcrumb. */
export function BreadcrumbPage(props: ComponentProps<'span'>) {
  return <span aria-current="page" className="font-semibold text-ink" {...props} />;
}

/** Separate places visually without adding spoken punctuation. */
export function BreadcrumbSeparator() {
  return (
    <li aria-hidden="true" className="inline-flex items-center text-muted">
      <ChevronRight size={14} strokeWidth={1.8} />
    </li>
  );
}
