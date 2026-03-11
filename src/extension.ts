import * as vscode from "vscode";
import { generateCommitMessages } from "./ai";
import { resolveDiff } from "./git";
import { AppError, type ExtensionConfig } from "./types";
import { showResultsPanel } from "./webview";

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration("aiCommitMessageGenerator");

  return {
    apiKey: config.get<string>("apiKey", "").trim(),
    model: config.get<string>("model", "gpt-5-mini").trim(),
    useSelectionFirst: config.get<boolean>("useSelectionFirst", true)
  };
}

async function insertIntoActiveEditor(message: string): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.isClosed) {
    return false;
  }

  await editor.edit((editBuilder) => {
    const selection = editor.selection;
    if (!selection.isEmpty) {
      editBuilder.replace(selection, message);
      return;
    }

    editBuilder.insert(selection.active, message);
  });

  return true;
}

async function handleInsert(message: string): Promise<void> {
  const inserted = await insertIntoActiveEditor(message);
  if (inserted) {
    void vscode.window.showInformationMessage("Commit message inserted into the active editor.");
    return;
  }

  await vscode.env.clipboard.writeText(message);
  void vscode.window.showInformationMessage(
    "Commit message copied to clipboard. Paste it into your target input."
  );
}

async function runGenerateCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const config = getConfig();
    const diffInput = await resolveDiff(config.useSelectionFirst);
    const result = await generateCommitMessages(diffInput.diff, config);

    showResultsPanel(context, result, diffInput.source, {
      onCopy: async (message) => {
        await vscode.env.clipboard.writeText(message);
        void vscode.window.showInformationMessage("Commit message copied to clipboard.");
      },
      onInsert: handleInsert
    });
  } catch (error) {
    if (error instanceof AppError) {
      void vscode.window.showErrorMessage(error.message);
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected extension failure.";
    void vscode.window.showErrorMessage(message);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "aiCommitMessageGenerator.generateCommitMessage",
    async () => {
      await runGenerateCommand(context);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
