import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StorageActionResult } from '../../services/storage';
import type { AppData, Category } from '../../types/finance';
import { createId } from '../../utils/ids';
import {
  addCategory,
  categoryFormFromCategory,
  categoryUsageById,
  deleteCategoryProblem,
  emptyCategoryForm,
  removeCategory,
  replaceCategory,
  validateCategoryForm,
  type CategoryFormErrors,
  type CategoryFormValues,
  type CategoryUsage,
} from './categoryLogic';

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; category: Category };

interface CategoryManagerProps {
  data: AppData;
  onChange(transform: (data: AppData) => AppData): StorageActionResult;
}

export default function CategoryManager({ data, onChange }: CategoryManagerProps) {
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const usage = categoryUsageById(data);

  function openForm(state: FormState): void {
    setFormState(state);
    setNotice('');
    setProblem('');
  }

  function closeForm(): void {
    setFormState({ mode: 'closed' });
    addButtonRef.current?.focus();
  }

  function handleSave(category: Category): StorageActionResult {
    const isEdit = formState.mode === 'edit';
    const result = onChange((current) =>
      isEdit ? replaceCategory(current, category) : addCategory(current, category),
    );
    if (result.ok) {
      setNotice(isEdit ? 'Category updated.' : 'Category added.');
      closeForm();
    }
    return result;
  }

  function handleDelete(category: Category): void {
    const blocked = deleteCategoryProblem(data, category.id);
    if (blocked !== null) {
      setProblem(`"${category.name}" cannot be deleted. ${blocked}`);
      setNotice('');
      return;
    }

    const budgetWarning = usage.get(category.id)?.hasBudget === true ? ' Its monthly budget will also be removed.' : '';
    if (!window.confirm(`Delete the category "${category.name}"?${budgetWarning}`)) {
      return;
    }

    const result = onChange((current) => removeCategory(current, category.id));
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setNotice('Category deleted.');
    setProblem('');
    setFormState((current) =>
      current.mode === 'edit' && current.category.id === category.id ? { mode: 'closed' } : current,
    );
  }

  const tableProps = {
    usage,
    onEdit: (category: Category) => openForm({ mode: 'edit', category }),
    onDelete: handleDelete,
  };

  return (
    <section className="card stack" aria-labelledby="categories-heading">
      <div className="page-header">
        <h2 id="categories-heading">Categories</h2>
        <button
          ref={addButtonRef}
          type="button"
          className="button button--primary"
          onClick={() => openForm({ mode: 'add' })}
        >
          Add category
        </button>
      </div>

      <p role="status" className={notice === '' ? 'visually-hidden' : 'notice'}>
        {notice}
      </p>
      {problem !== '' && (
        <p role="alert" className="notice notice--error">
          {problem}
        </p>
      )}

      {formState.mode !== 'closed' && (
        <CategoryForm
          key={formState.mode === 'edit' ? formState.category.id : 'new'}
          category={formState.mode === 'edit' ? formState.category : undefined}
          existingCategories={data.categories}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <CategoryTable
        title="Expense categories"
        categories={data.categories.filter((category) => category.kind === 'expense')}
        showBudget
        {...tableProps}
      />
      <CategoryTable
        title="Income categories"
        categories={data.categories.filter((category) => category.kind === 'income')}
        showBudget={false}
        {...tableProps}
      />
    </section>
  );
}

interface CategoryTableProps {
  title: string;
  categories: readonly Category[];
  usage: ReadonlyMap<string, CategoryUsage>;
  showBudget: boolean;
  onEdit(category: Category): void;
  onDelete(category: Category): void;
}

function CategoryTable({ title, categories, usage, showBudget, onEdit, onDelete }: CategoryTableProps) {
  return (
    <div className="stack">
      <h3>{title}</h3>
      {categories.length === 0 ? (
        <p className="muted">No categories yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="numeric">
                  Transactions
                </th>
                {showBudget && <th scope="col">Monthly budget</th>}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const categoryUsage = usage.get(category.id);
                return (
                  <tr key={category.id}>
                    <th scope="row">{category.name}</th>
                    <td className="numeric">{categoryUsage?.transactionCount ?? 0}</td>
                    {showBudget && <td>{categoryUsage?.hasBudget === true ? 'Set' : 'None'}</td>}
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="button button--small"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => onEdit(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => onDelete(category)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CategoryFormProps {
  category?: Category;
  existingCategories: readonly Category[];
  onSave(category: Category): StorageActionResult;
  onCancel(): void;
}

function CategoryForm({ category, existingCategories, onSave, onCancel }: CategoryFormProps) {
  const isEditing = category !== undefined;
  const [newId] = useState(() => createId());
  const [values, setValues] = useState<CategoryFormValues>(() =>
    category === undefined ? emptyCategoryForm() : categoryFormFromCategory(category),
  );
  const [errors, setErrors] = useState<CategoryFormErrors>({});
  const [formError, setFormError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = validateCategoryForm(values, category?.id ?? newId, existingCategories, category);

    if (!result.ok) {
      setErrors(result.errors);
      setFormError('');
      nameRef.current?.focus();
      return;
    }

    setErrors({});
    const saved = onSave(result.category);
    setFormError(saved.ok ? '' : saved.error);
  }

  return (
    <form className="form-panel stack" aria-labelledby="category-form-heading" onSubmit={handleSubmit} noValidate>
      <h3 id="category-form-heading">{isEditing ? 'Edit category' : 'Add category'}</h3>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="category-name">Category name</label>
          <input
            id="category-name"
            ref={nameRef}
            type="text"
            autoComplete="off"
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name !== undefined ? 'category-name-error' : undefined}
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
          {errors.name !== undefined && (
            <p id="category-name-error" className="field-error">
              {errors.name}
            </p>
          )}
        </div>

        <fieldset className="radio-group">
          <legend>Kind</legend>
          {(['expense', 'income'] as const).map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="category-kind"
                value={kind}
                checked={values.kind === kind}
                disabled={isEditing}
                onChange={() => setValues((current) => ({ ...current, kind }))}
              />
              {kind === 'expense' ? 'Expense' : 'Income'}
            </label>
          ))}
          {isEditing && <p className="field-hint">The kind of a category cannot be changed once it exists.</p>}
        </fieldset>
      </div>

      {formError !== '' && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          {isEditing ? 'Save changes' : 'Save category'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}