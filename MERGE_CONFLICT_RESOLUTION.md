# マージコンフリクト解決ガイド

## リポジトリ構成

このリポジトリは、オープンソースプロジェクト [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) をフォークしたものです。

- **`upstream`リモート**: オリジナルのオープンソースリポジトリ
- **`origin`リモート**: カスタマイズしたフォークリポジトリ

## カスタマイズ機能の概要

### 1. 高度なリポジトリ除外機能

**実装場所**: [`src/common/excluded-repos.js`](src/common/excluded-repos.js)

**機能説明**:
環境変数ベースで柔軟にリポジトリを除外できる機能。upstreamの単純な`EXCLUDE_REPO`環境変数（カンマ区切りのリポジトリ名リスト）に比べ、より高度な除外ルールを提供します。

#### サポートする環境変数

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `EXCLUDE_ARCHIVED` | アーカイブされたリポジトリを除外 | `true`/`false` |
| `EXCLUDE_FORK` | フォークしたリポジトリを除外 | `true`/`false` |
| `EXCLUDE_PRIVATE` | プライベートリポジトリを除外 | `true`/`false` |
| `EXCLUDE_EXACT` | 完全一致でリポジトリ名を除外 | `'repo1','repo2'` |
| `EXCLUDE_PATTERNS` | 正規表現パターンで除外 | `'/^test_/','/^dev_/'` |

#### 主要な関数

```javascript
// URL引数と環境変数を組み合わせた除外リポジトリセットを取得
getCombinedExcludedRepos(urlExcludedRepos)

// 内部ルール（環境変数ベース）でリポジトリを除外すべきか判定
isRepoExcludedByInternalRules(repo)
```

#### 使用箇所

- [`src/fetchers/stats.js`](src/fetchers/stats.js#L331): スター数計算時のリポジトリフィルタリング
- [`src/fetchers/top-languages.js`](src/fetchers/top-languages.js#L101): 言語統計計算時のリポジトリフィルタリング

## マージコンフリクト解決方針

### 基本方針

upstreamから最新コードを取り込む際にコンフリクトが発生した場合、以下の手順で解決します:

### 1. コンフリクト箇所の確認

```bash
git status
```

コンフリクトが発生しているファイルを特定します。

### 2. upstreamの新機能を理解する

```bash
# 最新のコミットログを確認
git log --oneline upstream/master -20

# 特定のキーワードでコミットを検索
git log --oneline upstream/master --grep="キーワード" -20

# READMEや関連ファイルを確認
```

upstreamでどのような新機能が追加されたのか、リファクタリングが行われたのかを理解します。

### 3. カスタマイズ機能とupstream機能の比較分析

両者の機能を比較し、以下のいずれかを判断します:

| 判断基準 | 採用方針 |
|---------|---------|
| カスタマイズがupstream機能の上位互換 | カスタマイズを維持、upstream構造を採用 |
| upstream機能がカスタマイズの上位互換 | upstreamを採用 |
| 両者が異なる価値を提供 | 両方を組み合わせる |
| upstreamがリファクタリング | 新構造を採用、カスタマイズロジックを移植 |

### 4. コンフリクトの解決

#### 例: リファクタリングコンフリクト（2025-10-25解決事例）

**状況**:

- upstreamが`utils.js`を複数モジュールに分割（`log.js`, `error.js`, `fmt.js`, `http.js`など）
- カスタマイズ機能の`excluded-repos.js`が旧`utils.js`をインポート

**解決策**:

1. upstreamの新しいモジュール構成を採用（コード品質向上のため）
2. カスタマイズした除外機能は維持（上位互換のため）

**変更内容**:

```javascript
// Before (コンフリクト前)
import {
  CustomError,
  logger,
  MissingParamError,
  request,
  wrapTextMultiline,
} from "../common/utils.js";
import {
  getCombinedExcludedRepos,
  isRepoExcludedByInternalRules,
} from "../common/excluded-repos.js";

// After (解決後)
import { logger } from "../common/log.js";
import { CustomError, MissingParamError } from "../common/error.js";
import { wrapTextMultiline } from "../common/fmt.js";
import { request } from "../common/http.js";
import {
  getCombinedExcludedRepos,
  isRepoExcludedByInternalRules,
} from "../common/excluded-repos.js";
```

### 5. テストで検証

```bash
npm test
```

コンフリクト解決後、必ずテストを実行して動作確認を行います。

### 6. マージコミット作成

```bash
git add <解決したファイル>
git commit -m "Merge upstream/master: 変更内容の要約"
```

## チェックリスト

マージコンフリクト解決時のチェックリスト:

- [ ] upstreamの変更内容を理解した（git log, README確認）
- [ ] カスタマイズ機能とupstream機能を比較分析した
- [ ] 採用方針を決定した（カスタマイズ維持/upstream採用/組み合わせ）
- [ ] コンフリクトを解決した
- [ ] テストが通ることを確認した（`npm test`）
- [ ] 動作確認を行った
- [ ] 必要に応じて本ドキュメントを更新した

## カスタマイズ機能の維持が必要な理由

### リポジトリ除外機能

upstreamの`EXCLUDE_REPO`は単純なカンマ区切りリストですが、カスタマイズ版は以下の利点があります:

1. **属性ベース除外**: `isArchived`, `isFork`, `isPrivate`などの属性で一括除外
2. **パターンマッチング**: 正規表現による柔軟な除外ルール
3. **セキュリティ**: 正規表現インジェクション対策実装済み
4. **後方互換性**: upstreamの`EXCLUDE_REPO`も引き続きサポート

これらの機能は、大規模なリポジトリを持つユーザーや、特定のパターンに従ったリポジトリ管理を行っているユーザーにとって必須です。

## トラブルシューティング

### よくある問題

**Q: テストが失敗する**
A: 以下を確認してください:

- インポートパスが正しいか
- カスタマイズ関数が正しく呼び出されているか
- 環境変数の読み込みが正しいか

**Q: 除外機能が動作しない**
A: [`src/common/excluded-repos.js`](src/common/excluded-repos.js)が正しくインポートされているか確認してください。

## 履歴

| 日付 | コンフリクト内容 | 解決方針 |
|------|----------------|---------|
| 2025-10-25 | upstreamのモジュール分割リファクタリング | 新構造を採用、カスタマイズ機能を維持 |

---

**最終更新**: 2025-10-25
