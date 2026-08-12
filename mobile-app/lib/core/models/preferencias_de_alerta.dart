/// O que este aparelho quer receber.
///
/// 🚨 **`null` quer dizer TODAS, não nenhuma.** É a regra que atravessa banco,
/// backend e app (ver a migration 032): quem nunca abriu a tela de
/// notificações não tem linha na tabela, e continua recebendo tudo — que é o
/// comportamento que existia antes desta feature.
///
/// Lista vazia é outra coisa: é o usuário que desmarcou tudo de propósito. Se
/// as duas virassem a mesma coisa, o deploy calaria todo mundo em silêncio, e
/// ninguém reclama de alerta que não chega — acha que o produto parou.
class PreferenciasDeAlerta {
  final List<String>? cidades;
  final List<String>? categorias;
  final bool estatisticas;

  const PreferenciasDeAlerta({
    this.cidades,
    this.categorias,
    this.estatisticas = true,
  });

  bool aceitaCidade(String nome) => cidades == null || cidades!.contains(nome);
  bool aceitaCategoria(String chave) =>
      categorias == null || categorias!.contains(chave);

  PreferenciasDeAlerta copyWith({
    List<String>? cidades,
    List<String>? categorias,
    bool? estatisticas,
    bool limparCidades = false,
    bool limparCategorias = false,
  }) => PreferenciasDeAlerta(
    cidades: limparCidades ? null : (cidades ?? this.cidades),
    categorias: limparCategorias ? null : (categorias ?? this.categorias),
    estatisticas: estatisticas ?? this.estatisticas,
  );

  factory PreferenciasDeAlerta.fromJson(Map<String, dynamic> json) =>
      PreferenciasDeAlerta(
        cidades: (json['cidades'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        categorias: (json['categorias'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        estatisticas: json['estatisticas'] as bool? ?? true,
      );

  Map<String, dynamic> toJson() => {
    'cidades': cidades,
    'categorias': categorias,
    'estatisticas': estatisticas,
  };
}
