GRITTY CITY — ASSET CITY 03
実バイナリGLBをroot直下へ収録した版。
住宅3種、店舗2種、モーテル、倉庫、セダン、ピックアップ、Dumpster、電柱、道路標識、ACユニット、PBR用途テクスチャを同梱。
ゲーム側はGLTFLoaderでGLBを実ロードし、7x7街区へ配置。距離カリングとiPhone/iPadタッチ操作を実装。
このGLB群は「実アセットパイプライン」の基礎生成物であり、AAAフォトリアル完成品とは表現していない。次段階は高密度ディテール、UV/PBRマップ、室内、デカール、汚れ、LODを増強する。
\n\nFIX 03.2:
- index.htmlにthree.js import mapを追加。GLTFLoader内部の `three` bare module specifierを解決。
- ES moduleでDOM IDを暗黙グローバル参照していた箇所を明示参照へ修正。
- 起動時エラー/非同期GLBロード失敗を画面上に表示。
- GLB全件のロード完了後にLOADING表示を消す。
