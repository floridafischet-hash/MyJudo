import 'package:flutter/material.dart';

import 'member.dart';
import 'member_repository.dart';

class MemberEditorDialog extends StatefulWidget {
  const MemberEditorDialog({
    required this.repository,
    required this.canEdit,
    required this.canChangeStatus,
    this.member,
    super.key,
  });

  final MemberRepository repository;
  final Member? member;
  final bool canEdit;
  final bool canChangeStatus;

  @override
  State<MemberEditorDialog> createState() => _MemberEditorDialogState();
}

class _MemberEditorDialogState extends State<MemberEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _number;
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late DateTime? _birthDate;
  late MemberStatus _status;
  late DateTime? _exitDate;
  bool _saving = false;
  String? _error;

  bool get _creating => widget.member == null;
  bool get _canEditFields => _creating || widget.canEdit;

  @override
  void initState() {
    super.initState();
    final member = widget.member;
    _number = TextEditingController(text: member?.memberNumber ?? '');
    _firstName = TextEditingController(text: member?.firstName ?? '');
    _lastName = TextEditingController(text: member?.lastName ?? '');
    _birthDate = member?.birthDate;
    _status = member?.status ?? MemberStatus.active;
    _exitDate = member?.exitDate;
  }

  @override
  void dispose() {
    _number.dispose();
    _firstName.dispose();
    _lastName.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool exitDate}) async {
    final current = exitDate ? _exitDate : _birthDate;
    final selected = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now(),
      firstDate: exitDate ? DateTime(2000) : DateTime(1900),
      lastDate: exitDate ? DateTime(2200) : DateTime.now(),
      helpText: exitDate
          ? 'Austrittsdatum auswählen'
          : 'Geburtsdatum auswählen',
    );
    if (selected == null || !mounted) return;
    setState(() {
      if (exitDate) {
        _exitDate = selected;
      } else {
        _birthDate = selected;
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_status == MemberStatus.exitScheduled && _exitDate == null) {
      setState(
        () => _error =
            'Für den vorgemerkten Austritt ist ein Datum erforderlich.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      Member saved;
      if (_creating) {
        saved = await widget.repository.create(
          memberNumber: _number.text,
          firstName: _firstName.text,
          lastName: _lastName.text,
          birthDate: _birthDate,
        );
      } else {
        saved = widget.member!;
        if (widget.canEdit) {
          saved = await widget.repository.update(
            saved.id,
            memberNumber: _number.text,
            firstName: _firstName.text,
            lastName: _lastName.text,
            birthDate: _birthDate,
          );
        }
        if (widget.canChangeStatus &&
            (_status != widget.member!.status ||
                _exitDate != widget.member!.exitDate)) {
          saved = await widget.repository.updateStatus(
            saved.id,
            status: _status,
            exitDate: _status == MemberStatus.exitScheduled ? _exitDate : null,
          );
        }
      }
      if (mounted) Navigator.of(context).pop(saved);
    } on MemberApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(_creating ? 'Mitglied anlegen' : 'Mitglied bearbeiten'),
    content: SizedBox(
      width: 560,
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _number,
                enabled: _canEditFields && !_saving,
                decoration: const InputDecoration(
                  labelText: 'Mitgliedsnummer *',
                ),
                validator: _required,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _firstName,
                enabled: _canEditFields && !_saving,
                decoration: const InputDecoration(labelText: 'Vorname *'),
                validator: _required,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _lastName,
                enabled: _canEditFields && !_saving,
                decoration: const InputDecoration(labelText: 'Nachname *'),
                validator: _required,
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: 12),
              _DateField(
                label: 'Geburtsdatum',
                value: _birthDate,
                enabled: _canEditFields && !_saving,
                onTap: () => _pickDate(exitDate: false),
              ),
              if (!_creating && widget.canChangeStatus) ...[
                const SizedBox(height: 20),
                DropdownButtonFormField<MemberStatus>(
                  initialValue: _status,
                  decoration: const InputDecoration(
                    labelText: 'Mitgliedschaftsstatus',
                  ),
                  items: MemberStatus.values
                      .map(
                        (status) => DropdownMenuItem(
                          value: status,
                          child: Text(status.label),
                        ),
                      )
                      .toList(),
                  onChanged: _saving
                      ? null
                      : (value) => setState(() {
                          _status = value ?? _status;
                          if (_status != MemberStatus.exitScheduled) {
                            _exitDate = null;
                          }
                        }),
                ),
                if (_status == MemberStatus.exitScheduled) ...[
                  const SizedBox(height: 12),
                  _DateField(
                    label: 'Austrittsdatum *',
                    value: _exitDate,
                    enabled: !_saving,
                    onTap: () => _pickDate(exitDate: true),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Der Mitgliedszugriff bleibt bis zum Ende des Austrittsmonats erhalten.',
                  ),
                ],
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _saving ? null : () => Navigator.of(context).pop(),
        child: const Text('Abbrechen'),
      ),
      if (_canEditFields || widget.canChangeStatus)
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Speichern'),
        ),
    ],
  );
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final DateTime? value;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: enabled ? onTap : null,
    borderRadius: BorderRadius.circular(4),
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        enabled: enabled,
        suffixIcon: const Icon(Icons.calendar_today_outlined),
      ),
      child: Text(value == null ? 'Nicht angegeben' : _formatDate(value!)),
    ),
  );
}

String? _required(String? value) => value == null || value.trim().isEmpty
    ? 'Dieses Feld ist erforderlich.'
    : null;

String _formatDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}';
