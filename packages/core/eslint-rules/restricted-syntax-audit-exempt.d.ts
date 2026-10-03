import type { TSESLint } from '@typescript-eslint/utils';
interface RestrictedEntry {
    selector: string;
    message?: string;
}
type Options = RestrictedEntry[];
type MessageIds = 'restrictedSyntax';
export declare const restrictedSyntaxAuditExempt: TSESLint.RuleModule<MessageIds, Options>;
export {};
