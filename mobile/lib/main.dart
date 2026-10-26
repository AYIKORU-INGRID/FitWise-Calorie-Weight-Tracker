import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (_supabaseUrl.isNotEmpty && _supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(url: _supabaseUrl, anonKey: _supabaseAnonKey);
  }
  runApp(const FitWiseApp());
}

class FitWiseApp extends StatelessWidget {
  const FitWiseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FitWise',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff217a68),
          surface: const Color(0xfff5f8f6),
        ),
        scaffoldBackgroundColor: const Color(0xfff5f8f6),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
        ),
      ),
      home: _supabaseUrl.isEmpty || _supabaseAnonKey.isEmpty
          ? const _ConfigurationScreen()
          : const _SessionGate(),
    );
  }
}

class _ConfigurationScreen extends StatelessWidget {
  const _ConfigurationScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.monitor_weight_outlined, size: 52),
              SizedBox(height: 16),
              Text('Connect FitWise', style: TextStyle(fontSize: 24)),
              SizedBox(height: 12),
              Text(
                'Configure SUPABASE_URL and SUPABASE_ANON_KEY using the '
                'mobile setup instructions, then restart the app.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SessionGate extends StatelessWidget {
  const _SessionGate();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = snapshot.data?.session ??
            Supabase.instance.client.auth.currentSession;
        return session == null ? const _SignInScreen() : const _TrackerScreen();
      },
    );
  }
}

class _SignInScreen extends StatefulWidget {
  const _SignInScreen();

  @override
  State<_SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<_SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _creatingAccount = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final auth = Supabase.instance.client.auth;
      if (_creatingAccount) {
        final result = await auth.signUp(
          email: _email.text.trim(),
          password: _password.text,
        );
        if (result.session == null && mounted) {
          setState(() {
            _message = 'Check your email to confirm your account, then sign in.';
          });
        }
      } else {
        await auth.signInWithPassword(
          email: _email.text.trim(),
          password: _password.text,
        );
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => _message = error.message);
    } catch (error) {
      if (mounted) setState(() => _message = 'Could not connect: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.monitor_weight_outlined, size: 48),
                      const SizedBox(height: 12),
                      Text(
                        'FitWise',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _creatingAccount
                            ? 'Create an account for your private tracker.'
                            : 'Sign in to your private tracker.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(labelText: 'Email'),
                        validator: (value) =>
                            value == null || !value.contains('@')
                                ? 'Enter a valid email address.'
                                : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration:
                            const InputDecoration(labelText: 'Password'),
                        validator: (value) =>
                            value == null || value.length < 6
                                ? 'Use at least 6 characters.'
                                : null,
                      ),
                      if (_message != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _message!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: Text(
                          _busy
                              ? 'Please wait…'
                              : _creatingAccount
                                  ? 'Create account'
                                  : 'Sign in',
                        ),
                      ),
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                  _creatingAccount = !_creatingAccount;
                                  _message = null;
                                }),
                        child: Text(
                          _creatingAccount
                              ? 'Already have an account? Sign in'
                              : 'New to FitWise? Create an account',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TrackerData {
  _TrackerData({
    this.goal = 2000,
    this.goalWeight,
    Map<String, List<Map<String, dynamic>>>? foods,
    List<Map<String, dynamic>>? weights,
    Map<String, int>? water,
    this.weightUnit = 'kg',
    this.waterGoal = 8,
    this.theme = 'system',
    this.setupComplete = false,
  })  : foods = foods ?? {},
        weights = weights ?? [],
        water = water ?? {};

  int goal;
  double? goalWeight;
  final Map<String, List<Map<String, dynamic>>> foods;
  final List<Map<String, dynamic>> weights;
  final Map<String, int> water;
  String weightUnit;
  int waterGoal;
  String theme;
  bool setupComplete;

  factory _TrackerData.fromJson(Map<String, dynamic>? json) {
    if (json == null) return _TrackerData();
    final foods = <String, List<Map<String, dynamic>>>{};
    final rawFoods = json['foods'];
    if (rawFoods is Map) {
      for (final entry in rawFoods.entries) {
        if (entry.value is List) {
          foods[entry.key.toString()] = (entry.value as List)
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
        }
      }
    }
    final weights = <Map<String, dynamic>>[];
    if (json['weights'] is List) {
      for (final item in json['weights'] as List) {
        if (item is Map) weights.add(Map<String, dynamic>.from(item));
      }
    }
    final water = <String, int>{};
    if (json['water'] is Map) {
      for (final entry in (json['water'] as Map).entries) {
        if (entry.value is int && (entry.value as int) >= 0) {
          water[entry.key.toString()] = entry.value as int;
        }
      }
    }
    final preferences = json['preferences'];
    final rawGoalWeight = json['goalWt'];
    final rawGoal = json['goal'];
    final rawUnit = preferences is Map ? preferences['weightUnit'] : null;
    final rawWaterGoal = preferences is Map ? preferences['waterGoal'] : null;
    final rawTheme = preferences is Map ? preferences['theme'] : null;
    return _TrackerData(
      goal: rawGoal is int && rawGoal >= 800 && rawGoal <= 6000
          ? rawGoal
          : 2000,
      goalWeight: rawGoalWeight is num ? rawGoalWeight.toDouble() : null,
      foods: foods,
      weights: weights,
      water: water,
      weightUnit: rawUnit == 'lb' ? 'lb' : 'kg',
      waterGoal: rawWaterGoal is int && rawWaterGoal >= 1 && rawWaterGoal <= 40
          ? rawWaterGoal
          : 8,
      theme: ['system', 'light', 'dark'].contains(rawTheme)
          ? rawTheme as String
          : 'system',
      setupComplete: json['setupComplete'] == true,
    );
  }

  factory _TrackerData.clone(_TrackerData source) =>
      _TrackerData.fromJson(source.toJson());

  Map<String, dynamic> toJson() => {
        'goal': goal,
        'goalWt': goalWeight,
        'foods': foods,
        'weights': weights,
        'water': water,
        'preferences': {
          'theme': theme,
          'weightUnit': weightUnit,
          'waterGoal': waterGoal,
        },
        'setupComplete': setupComplete,
      };
}

class _TrackerScreen extends StatefulWidget {
  const _TrackerScreen();

  @override
  State<_TrackerScreen> createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<_TrackerScreen> {
  final _foodName = TextEditingController();
  final _foodCalories = TextEditingController();
  final _weight = TextEditingController();
  late Future<void> _loading;
  _TrackerData _data = _TrackerData();
  bool _saving = false;
  String? _error;
  int _tab = 0;

  String get _today => DateFormat('yyyy-MM-dd').format(DateTime.now());
  List<Map<String, dynamic>> get _todayFoods =>
      _data.foods[_today] ?? const [];
  int get _todayCalories => _todayFoods.fold<int>(
        0,
        (total, food) => total + (food['kcal'] as int? ?? 0),
      );
  int get _todayWater => _data.water[_today] ?? 0;

  @override
  void initState() {
    super.initState();
    _loading = _load();
  }

  @override
  void dispose() {
    _foodName.dispose();
    _foodCalories.dispose();
    _weight.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return;
    final result = await client
        .from('tracker_data')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle();
    final raw = result?['data'];
    if (mounted) {
      setState(() {
        _data = _TrackerData.fromJson(
          raw is Map ? Map<String, dynamic>.from(raw) : null,
        );
      });
    }
    if (result == null) await _save(_data);
  }

  Future<void> _save(_TrackerData data) async {
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) throw Exception('Sign in again to save your tracker.');
    await client.from('tracker_data').upsert({
      'user_id': user.id,
      'data': data.toJson(),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }, onConflict: 'user_id');
  }

  Future<void> _update(void Function(_TrackerData data) change) async {
    if (_saving) return;
    final previous = _TrackerData.clone(_data);
    final updated = _TrackerData.clone(_data);
    change(updated);
    setState(() {
      _saving = true;
      _error = null;
      _data = updated;
    });
    try {
      await _save(updated);
    } catch (error) {
      if (mounted) {
        setState(() {
          _data = previous;
          _error = 'Could not save your tracker. Check your connection and '
              'Supabase setup, then try again. ($error)';
        });
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addFood() async {
    final name = _foodName.text.trim();
    final calories = int.tryParse(_foodCalories.text);
    if (name.isEmpty || name.length > 60 || calories == null ||
        calories < 1 || calories > 5000) {
      setState(() => _error =
          'Enter a food name (up to 60 characters) and calories from 1 to 5000.');
      return;
    }
    final meal = switch (DateTime.now().hour) {
      < 11 => 'Breakfast',
      < 16 => 'Lunch',
      < 21 => 'Dinner',
      _ => 'Snack',
    };
    await _update((data) {
      data.foods.putIfAbsent(_today, () => []);
      data.foods[_today]!.add({
        'id': DateTime.now().microsecondsSinceEpoch,
        'name': name,
        'kcal': calories,
        'meal': meal,
      });
    });
    if (_error == null && mounted) {
      _foodName.clear();
      _foodCalories.clear();
    }
  }

  Future<void> _addWeight() async {
    final displayValue = double.tryParse(_weight.text);
    final maxDisplayWeight = _data.weightUnit == 'lb' ? 881.8 : 400.0;
    if (displayValue == null ||
        displayValue < (_data.weightUnit == 'lb' ? 44.1 : 20) ||
        displayValue > maxDisplayWeight ||
        (displayValue * 10 - (displayValue * 10).round()).abs() > 1e-8) {
      setState(() => _error =
          'Enter a valid weight from ${_data.weightUnit == 'lb' ? '44.1 to 881.8 lb' : '20 to 400 kg'}.');
      return;
    }
    final kg =
        _data.weightUnit == 'lb' ? displayValue / 2.2046226218 : displayValue;
    if (kg < 20 || kg > 400) {
      setState(() => _error = 'Weight must be between 20 and 400 kg.');
      return;
    }
    await _update((data) {
      data.weights.removeWhere((entry) => entry['date'] == _today);
      data.weights.add(
        {'date': _today, 'kg': double.parse(kg.toStringAsFixed(1))},
      );
    });
    if (_error == null && mounted) _weight.clear();
  }

  Future<void> _editGoal() async {
    final controller = TextEditingController(text: _data.goal.toString());
    final goal = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Daily calorie goal'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Calories',
            helperText: 'Enter a whole number from 800 to 6000.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(controller.text);
              if (value != null && value >= 800 && value <= 6000) {
                Navigator.pop(context, value);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (goal != null) await _update((data) => data.goal = goal);
  }

  Future<void> _changeUnit() async {
    await _update(
      (data) => data.weightUnit = data.weightUnit == 'kg' ? 'lb' : 'kg',
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _loading,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Could not load your tracker.'),
                    const SizedBox(height: 8),
                    Text(snapshot.error.toString()),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => setState(() => _loading = _load()),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return Scaffold(
          appBar: AppBar(
            title: const Text('FitWise'),
            actions: [
              IconButton(
                tooltip: 'Switch weight units',
                onPressed: _saving ? null : _changeUnit,
                icon: Text(_data.weightUnit),
              ),
              IconButton(
                tooltip: 'Sign out',
                onPressed: () => Supabase.instance.client.auth.signOut(),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: SafeArea(
            child: Column(
              children: [
                if (_error != null)
                  MaterialBanner(
                    content: Text(_error!),
                    actions: [
                      TextButton(
                        onPressed: () => setState(() => _error = null),
                        child: const Text('Dismiss'),
                      ),
                    ],
                  ),
                Expanded(
                  child: IndexedStack(
                    index: _tab,
                    children: [
                      _caloriesPage(context),
                      _weightPage(context),
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (index) => setState(() => _tab = index),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.restaurant_menu),
                label: 'Calories',
              ),
              NavigationDestination(
                icon: Icon(Icons.monitor_weight_outlined),
                label: 'Weight',
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _caloriesPage(BuildContext context) {
    final left = _data.goal - _todayCalories;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          DateFormat('EEEE, d MMMM').format(DateTime.now()),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Calories today',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            '$_todayCalories',
                            style: Theme.of(context).textTheme.displaySmall,
                          ),
                          Text('of ${_data.goal} kcal'),
                        ],
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _saving ? null : _editGoal,
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Goal'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                LinearProgressIndicator(
                  value: (_todayCalories / _data.goal).clamp(0.0, 1.0).toDouble(),
                  minHeight: 9,
                  borderRadius: BorderRadius.circular(8),
                ),
                const SizedBox(height: 8),
                Text(left >= 0 ? '$left kcal left' : '${-left} kcal over'),
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Water today',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(Icons.water_drop_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$_todayWater of ${_data.waterGoal} glasses · '
                        '${_todayWater * 250} ml',
                      ),
                    ),
                    IconButton(
                      onPressed: _saving || _todayWater == 0
                          ? null
                          : () => _update((data) {
                                if (_todayWater <= 1) {
                                  data.water.remove(_today);
                                } else {
                                  data.water[_today] = _todayWater - 1;
                                }
                              }),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    IconButton(
                      onPressed: _saving || _todayWater >= 40
                          ? null
                          : () => _update(
                                (data) => data.water[_today] = _todayWater + 1,
                              ),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Add food', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextField(
                  controller: _foodName,
                  maxLength: 60,
                  decoration: const InputDecoration(
                    labelText: 'Food name',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _foodCalories,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Calories (kcal)'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _addFood,
                    icon: const Icon(Icons.add),
                    label: const Text('Add to today'),
                  ),
                ),
              ],
            ),
          ),
        ),
        Text('Today’s food', style: Theme.of(context).textTheme.titleLarge),
        if (_todayFoods.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Nothing logged yet. Add your first meal above.'),
            ),
          )
        else
          ..._todayFoods.asMap().entries.map(
                (entry) => Card(
                  child: ListTile(
                    title: Text(entry.value['name'] as String? ?? 'Food'),
                    subtitle: Text(entry.value['meal'] as String? ?? ''),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${entry.value['kcal'] ?? 0} kcal'),
                        IconButton(
                          tooltip: 'Delete food',
                          onPressed: _saving
                              ? null
                              : () => _update((data) {
                                    data.foods[_today]!.removeAt(entry.key);
                                    if (data.foods[_today]!.isEmpty) {
                                      data.foods.remove(_today);
                                    }
                                  }),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _weightPage(BuildContext context) {
    final entries = _data.weights.toList()
      ..sort((a, b) => (b['date'] as String).compareTo(a['date'] as String));
    final latest = entries.isEmpty ? null : entries.first;
    final latestKg = (latest?['kg'] as num?)?.toDouble();
    final latestDisplay = latestKg == null
        ? null
        : _data.weightUnit == 'lb'
            ? latestKg * 2.2046226218
            : latestKg;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Your weight', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Latest entry',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  latestDisplay == null
                      ? 'No weight logged yet'
                      : '${latestDisplay.toStringAsFixed(1)} '
                          '${_data.weightUnit} · ${latest!['date']}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _weight,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Weight today (${_data.weightUnit})',
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _addWeight,
                    icon: const Icon(Icons.save_outlined),
                    label: const Text('Save today’s weight'),
                  ),
                ),
              ],
            ),
          ),
        ),
        Text('History', style: Theme.of(context).textTheme.titleLarge),
        if (entries.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Your weight entries will appear here.'),
            ),
          )
        else
          ...entries.map((entry) {
            final kg = (entry['kg'] as num).toDouble();
            final value =
                _data.weightUnit == 'lb' ? kg * 2.2046226218 : kg;
            return Card(
              child: ListTile(
                leading: const Icon(Icons.monitor_weight_outlined),
                title: Text('${value.toStringAsFixed(1)} ${_data.weightUnit}'),
                subtitle: Text(entry['date'] as String),
                trailing: IconButton(
                  tooltip: 'Delete weight',
                  onPressed: _saving
                      ? null
                      : () => _update(
                            (data) => data.weights.removeWhere(
                              (item) => item['date'] == entry['date'],
                            ),
                          ),
                  icon: const Icon(Icons.delete_outline),
                ),
              ),
            );
          }),
      ],
    );
  }
}
