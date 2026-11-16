import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import RuleManager from './RuleManager';

interface HarnessProps {
  initial?: AppData;
  failSaves?: boolean;
}

function Harness({ initial, failSaves = false }: HarnessProps) {
  const [data, setData] = useState(initial ?? makeValidData());

  function onChange(transform: (current: AppData) => AppData): StorageActionResult {
    if (failSaves) {
      return { ok: false, error: 'Could not save: storage is full.' };
    }
    setData(transform(data));
    return { ok: true };
  }

  return <RuleManager data={data} onChange={onChange} />;
}

function withBeanBarnRule(): AppData {
  return { ...makeValidData(), categoryRules: [{ id: 'r1', keyword: 'Bean Barn', categoryId: 'cat-food' }] };
}

function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
  return screen.getByRole('form', { name: 'Add rule' });
}

describe('RuleManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('explains when there are no rules yet', () => {
    render(<Harness />);
    expect(screen.getByText('You have not added any rules yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('adds a rule and shows it with its category name', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.change(within(form).getByLabelText('Keyword'), { target: { value: 'Bean Barn' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save rule' }));

    expect(screen.getByText('Rule added.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: 'Bean Barn' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('Food')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add rule' })).toHaveFocus();
  });

  it('shows problems next to the fields and focuses the first one', () => {
    render(<Harness initial={withBeanBarnRule()} />);
    const form = openAddForm();

    fireEvent.click(within(form).getByRole('button', { name: 'Save rule' }));
    expect(within(form).getByText('Enter a keyword.')).toBeInTheDocument();
    expect(within(form).getByText('Choose a category.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Keyword')).toHaveFocus();

    fireEvent.change(within(form).getByLabelText('Keyword'), { target: { value: 'bean barn!' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save rule' }));
    expect(within(form).getByText('You already have a rule for "bean barn".')).toBeInTheDocument();
  });

  it('edits a rule', () => {
    render(<Harness initial={withBeanBarnRule()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule Bean Barn' }));

    const form = screen.getByRole('form', { name: 'Edit rule' });
    expect(within(form).getByLabelText('Keyword')).toHaveValue('Bean Barn');
    fireEvent.change(within(form).getByLabelText('Keyword'), { target: { value: 'Bean Barn Cafe' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Rule updated.')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Bean Barn Cafe' })).toBeInTheDocument();
  });

  it('deletes a rule only after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness initial={withBeanBarnRule()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete rule Bean Barn' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Bean Barn'));
    expect(screen.getByRole('rowheader', { name: 'Bean Barn' })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule Bean Barn' }));
    expect(screen.queryByRole('rowheader', { name: 'Bean Barn' })).not.toBeInTheDocument();
    expect(screen.getByText('Rule deleted.')).toBeInTheDocument();
  });

  it('keeps the form open and shows the error when saving fails', () => {
    render(<Harness failSaves />);
    const form = openAddForm();
    fireEvent.change(within(form).getByLabelText('Keyword'), { target: { value: 'Bean Barn' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save rule' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Could not save: storage is full.');
  });
});

describe('RuleManager: trying a description', () => {
  it('asks for some text first', () => {
    render(<Harness />);
    expect(screen.getByText(/Type a description above/)).toBeInTheDocument();
  });

  it('shows the category and the rule that decided it', () => {
    render(<Harness initial={withBeanBarnRule()} />);
    fireEvent.change(screen.getByLabelText('Description or merchant'), { target: { value: 'Bean Barn coffee' } });
    expect(screen.getByText('Suggested category: Food (your rule "bean barn")')).toBeInTheDocument();
  });

  it('says when nothing matches, including for the wrong kind of transaction', () => {
    render(<Harness initial={withBeanBarnRule()} />);
    fireEvent.change(screen.getByLabelText('Description or merchant'), { target: { value: 'Unknown shop' } });
    expect(screen.getByText('No suggestion: no rule matches this text.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Description or merchant'), { target: { value: 'Bean Barn' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'income' } });
    expect(screen.getByText('No suggestion: no rule matches this text.')).toBeInTheDocument();
  });
});