GRITTY CITY — BOOT FIX 04

今回のブラックスクリーン対策版。

重要な変更:
1. main.js の起動時に GLTFLoader を必須importしない。
2. Three.js / WebGL / レンダラー生成を先に完了させる。
3. レンダラー起動直後に、道路・住宅・店舗・倉庫・車・電柱・遠景建物からなる
   フォールバック都市を必ず表示する。
4. GLBロードは起動後の二次レイヤーに分離。GLBロード失敗でも黒画面にならない。
5. 未定義だった loadingEl.remove() を削除。
6. DOM参照をすべて明示的な getElementById に統一。
7. GLTFLoaderのimport mapをthree/addons/まで定義。
8. 全49チャンクの同期的な大量GLBロードを廃止し、まず近景だけをロード。
9. JSエラー / Promiseエラーを画面上に表示。
10. iPhone/iPad向けのタッチ操作は維持。

起動について:
- 推奨: HTTP/HTTPSサーバー経由で index.html を開く。
- Three.js公式もCDN + import map構成ではローカルサーバー利用を案内している。
- ZIPを展開しただけでfile://から開いた場合、GLBファイルの取得がブラウザの
  セキュリティ制限で失敗することがある。その場合でも今回の版はフォールバック都市を表示する。
- 画面左下のステータスで起動段階を確認できる。

ファイル構成はルート直下のみ。
