'use client';

import { FileText, ExternalLink, CheckCircle, Clock } from 'lucide-react';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  description: string;
  stripeInvoiceId?: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: 'paid' | 'pending' | 'failed' }) {
  const configs = {
    paid: { icon: CheckCircle, className: 'bg-emerald-900/30 text-emerald-400', label: 'Paid' },
    pending: { icon: Clock, className: 'bg-amber-900/30 text-amber-400', label: 'Pending' },
    failed: { icon: XCircle, className: 'bg-red-900/30 text-red-400', label: 'Failed' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

interface InvoicesClientProps {
  invoices: Invoice[];
}

export function InvoicesClient({ invoices }: InvoicesClientProps) {
  // For now, all invoices from our transaction history are "paid" since Stripe handles the actual payment
  // In a real implementation, we'd fetch from Stripe's Invoice API
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 20);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoice History</h1>
          <p className="text-sm text-slate-500 mt-1">View and download your past invoices</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Past Invoices</h2>
        </div>

        {sortedInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No invoices yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Invoices are created when you purchase credits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {invoice.description}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-right text-white whitespace-nowrap">
                      {formatAmount(invoice.amount)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <StatusBadge status="paid" />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {invoice.stripeInvoiceId ? (
                        <a
                          href={`https://dashboard.stripe.com/invoices/${invoice.stripeInvoiceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Invoice
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
