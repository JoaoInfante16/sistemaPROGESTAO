import 'dart:convert';
import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/news_item.dart';

class LocalDbService {
  static Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    // Migrar DB antigo se existir
    final dbPath = await getDatabasesPath();
    final oldPath = join(dbPath, 'netrios_news.db');
    final newPath = join(dbPath, 'simeops.db');
    if (await File(oldPath).exists() && !await File(newPath).exists()) {
      await File(oldPath).rename(newPath);
    }
    final path = newPath;
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE news (
            id TEXT PRIMARY KEY,
            tipo_crime TEXT NOT NULL,
            cidade TEXT NOT NULL,
            bairro TEXT,
            rua TEXT,
            data_ocorrencia TEXT NOT NULL,
            resumo TEXT NOT NULL,
            confianca REAL,
            created_at TEXT NOT NULL,
            sources TEXT,
            synced_at TEXT NOT NULL
          )
        ''');
        await db.execute(
          'CREATE INDEX idx_news_created ON news(created_at DESC)',
        );
        await db.execute(
          'CREATE INDEX idx_news_cidade ON news(cidade)',
        );
      },
    );
  }

  Future<void> upsertNews(List<NewsItem> items) async {
    final db = await database;
    final batch = db.batch();

    for (final item in items) {
      batch.insert(
        'news',
        {
          'id': item.id,
          'tipo_crime': item.tipoCrime,
          'cidade': item.cidade,
          'bairro': item.bairro,
          'rua': item.rua,
          'data_ocorrencia': item.dataOcorrencia.toIso8601String(),
          'resumo': item.resumo,
          'confianca': item.confianca,
          'created_at': item.createdAt.toIso8601String(),
          'sources': jsonEncode(
            item.sources
                .map((s) => {'url': s.url, 'source_name': s.sourceName})
                .toList(),
          ),
          'synced_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    await batch.commit(noResult: true);
  }

  Future<List<NewsItem>> getCachedNews({
    int limit = 50,
    int offset = 0,
    String? cidade,
  }) async {
    final db = await database;

    String where = '1=1';
    final args = <dynamic>[];

    if (cidade != null) {
      where += ' AND cidade = ?';
      args.add(cidade);
    }

    final rows = await db.query(
      'news',
      where: where,
      whereArgs: args,
      orderBy: 'created_at DESC',
      limit: limit,
      offset: offset,
    );

    return rows.map(_rowToNewsItem).toList();
  }

  Future<int> getCachedCount() async {
    final db = await database;
    final result = await db.rawQuery('SELECT COUNT(*) as c FROM news');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<void> clearOldNews({int keepDays = 30}) async {
    final db = await database;
    final cutoff =
        DateTime.now().subtract(Duration(days: keepDays)).toIso8601String();
    await db.delete('news', where: 'created_at < ?', whereArgs: [cutoff]);
  }

  NewsItem _rowToNewsItem(Map<String, dynamic> row) {
    List<NewsSource> sources = [];
    if (row['sources'] != null) {
      final decoded = jsonDecode(row['sources'] as String) as List<dynamic>;
      sources = decoded
          .map((s) => NewsSource.fromJson(s as Map<String, dynamic>))
          .toList();
    }

    return NewsItem(
      id: row['id'] as String,
      tipoCrime: row['tipo_crime'] as String,
      cidade: row['cidade'] as String,
      bairro: row['bairro'] as String?,
      rua: row['rua'] as String?,
      dataOcorrencia: DateTime.parse(row['data_ocorrencia'] as String),
      resumo: row['resumo'] as String,
      confianca: row['confianca'] as double?,
      createdAt: DateTime.parse(row['created_at'] as String),
      sources: sources,
    );
  }
}
