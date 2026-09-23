# SpecNote

製品スペックをツリー構造で編集し、製品データまたはテンプレートとしてJSONに書き出すWebアプリです。

## 開発

```bash
npm install
npm run dev
```

本番ビルドは次のコマンドで実行します。

```bash
npm run build
```

## JSON形式

ルートの `items` 配列に大項目を格納します。各項目は `name`、`children`、`elementLists` を持ち、要素リストは `label`、`type`、`unit`、`precision`、`elements` を持ちます。

- `type`: `string`、`integer`、`number`
- JSONは2スペースで整形し、アプリ内部のIDは出力しません
- テンプレートJSONでは要素配列を空にします
