"""Regression checks for real rank changes, cold starts and failed snapshots."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.dont_write_bytecode = True
import sync_ugc as ugc


def entries(prefix='item', count=100):
    return [{'id': f'{prefix}-{index}', 'title': f'Work {index}', 'url': f'https://example.com/{index}',
             'creator': 'Creator', 'categories': [], 'summary': '', 'metricValue': 1000 - index, 'publishedAt': None}
            for index in range(1, count + 1)]


def snapshot(rows, day, history=None, key='cs2'):
    ugc.validate_entries(rows, ugc.PLATFORMS[key]['rankingLimit'])
    return ugc.enrich_snapshot(key, rows, day, day + 'T01:00:00+00:00', history or {})


def historical(board):
    return {board['date']: {'schemaVersion': 1, 'date': board['date'], 'platforms': {board['id']: board}}}


class RankChanges(unittest.TestCase):
    def setUp(self):
        self.rows = entries()
        self.first = snapshot(self.rows, '2026-10-20')
        self.history = historical(self.first)

    def test_cold_start_is_not_a_hundred_new_entries(self):
        self.assertTrue(self.first['isBaseline'])
        self.assertEqual(self.first['counts']['newEntries'], 0)
        self.assertTrue(all(row['rankDelta'] is None and not row['isStrongNewEntry'] for row in self.first['entries']))

    def test_rise_and_high_new_entry_without_invented_outside_rank(self):
        newcomer = {**entries('new')[0], 'metricValue': 5000}
        rows = [newcomer, self.rows[49], *self.rows[:49], *self.rows[50:99]]
        second = snapshot(rows, '2026-10-21', self.history)
        new, moved = second['entries'][:2]
        self.assertIsNone(new['rankDelta'])
        self.assertIsNone(new['previousRank'])
        self.assertTrue(new['isNewEntry'])
        self.assertTrue(new['isStrongNewEntry'])
        self.assertEqual(moved['rankDelta'], 48)
        self.assertFalse(moved['isNewEntry'])
        self.assertFalse(moved['isStrongNewEntry'])
        self.assertEqual(second['comparisonDays'], 1)

    def test_same_day_rerun_keeps_previous_calendar_day(self):
        rows = [self.rows[1], self.rows[0], *self.rows[2:]]
        second = snapshot(rows, '2026-10-21', self.history)
        history = {**self.history, **historical(second)}
        rerun = snapshot(rows, '2026-10-21', history)
        self.assertEqual(rerun['entries'][0]['rankDelta'], 1)
        self.assertEqual(rerun['comparisonDate'], '2026-10-20')

    def test_gap_is_explicit_and_not_a_daily_growth_claim(self):
        rows = deepcopy(self.rows)
        rows[0]['metricValue'] = 100000
        later = snapshot(rows, '2026-10-24', self.history)
        self.assertEqual(later['comparisonDays'], 4)
        self.assertIsNone(later['entries'][0]['rankDelta7d'])
        self.assertFalse(later['entries'][0]['isStrongNewEntry'])

    def test_seven_day_change_uses_exact_date(self):
        rows = [self.rows[9], *self.rows[:9], *self.rows[10:]]
        later = snapshot(rows, '2026-10-27', self.history)
        self.assertEqual(later['entries'][0]['rankDelta7d'], 9)
        without_target = snapshot(rows, '2026-10-28', self.history)
        self.assertIsNone(without_target['entries'][0]['rankDelta7d'])

    def test_changed_source_scope_restarts_baseline(self):
        self.first['rankingKey'] = 'retired-source'
        later = snapshot(self.rows, '2026-10-21', historical(self.first))
        self.assertTrue(later['isBaseline'])
        self.assertEqual(later['counts']['newEntries'], 0)

    def test_reentry_is_labeled_returning(self):
        second = snapshot([*self.rows[:99], entries('new')[0]], '2026-10-21', self.history)
        later = snapshot([self.rows[99], *second['entries'][:99]], '2026-10-22', {**self.history, **historical(second)})
        returned = later['entries'][0]
        self.assertTrue(returned['isReturning'])
        self.assertEqual(returned['firstSeenAt'], '2026-10-20')

    def test_invalid_or_duplicate_complete_board_is_rejected(self):
        with self.assertRaises(ValueError):
            ugc.validate_entries(self.rows[:99])
        with self.assertRaises(ValueError):
            ugc.validate_entries([self.rows[0], *self.rows[:99]])
        with self.assertRaises(ValueError):
            ugc.validate_entries([{**self.rows[0], 'metricValue': float('nan')}, *self.rows[1:]])

    def test_failed_source_keeps_its_real_last_success_time(self):
        test_parent = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(prefix='.ugc-test-', dir=test_parent) as directory:
            self.assertEqual(Path(directory).resolve().parent, test_parent)
            root = Path(directory)
            fetched = {key: entries(key, config['rankingLimit']) for key, config in ugc.PLATFORMS.items()}
            first = ugc.publish(root, fetched, {}, '2026-10-20', '2026-10-20T01:00:00Z')
            second = ugc.publish(root, {'cs2': entries('cs2')}, {'roblox': 'HTTP 503'}, '2026-10-21', '2026-10-21T01:00:00Z')
            self.assertEqual(second['platforms']['roblox']['status'], 'stale')
            self.assertEqual(second['platforms']['roblox']['collectedAt'], first['platforms']['roblox']['collectedAt'])
            today = ugc.read_json(root / 'data/ugc/history/2026-10-21.json')
            self.assertNotIn('roblox', today['platforms'])
            self.assertEqual(second['runStatus'], 'partial')

    def test_hot_and_alltime_never_compare_across_boards(self):
        later = snapshot(entries(count=200), '2026-10-21', self.history, 'cs2_alltime')
        self.assertTrue(later['isBaseline'])

    def test_expansion_does_not_invent_new_entries_from_old_top100(self):
        key = 'cs2_alltime'
        legacy = {**self.first, 'id': key, 'boardType': 'alltime', 'rankingKey': 'steam-cs2-map-lifetime-subscriptions-v1'}
        history = {'2026-10-20': {'platforms': {key: legacy}}}
        expanded = snapshot(entries(count=200), '2026-10-21', history, key)
        self.assertTrue(expanded['isBaseline'])
        self.assertEqual(expanded['counts']['newEntries'], 0)
        self.assertIsNone(expanded['entries'][199]['rankDelta'])

    def test_top200_compares_positions_below_100(self):
        first = snapshot(entries(count=200), '2026-10-20', key='cs2_alltime')
        rows = first['entries'].copy()
        rows[119], rows[179] = rows[179], rows[119]
        second = snapshot(rows, '2026-10-21', historical(first), 'cs2_alltime')
        self.assertFalse(second['isBaseline'])
        self.assertEqual(second['entries'][119]['rankDelta'], 60)
        self.assertEqual(second['entries'][179]['rankDelta'], -60)

    def test_selective_refresh_preserves_hot_board_and_timestamp(self):
        test_parent = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(prefix='.ugc-test-', dir=test_parent) as directory:
            root = Path(directory)
            fetched = {key: entries(key, config['rankingLimit']) for key, config in ugc.PLATFORMS.items()}
            first = ugc.publish(root, fetched, {}, '2026-10-20', '2026-10-20T01:00:00Z')
            selected = {'cs2_alltime'}
            second = ugc.publish(root, {'cs2_alltime': entries(count=200)}, {}, '2026-10-21', '2026-10-21T02:00:00Z', selected)
            self.assertEqual(first['platforms']['cs2'], second['platforms']['cs2'])
            self.assertEqual(second['platforms']['cs2_alltime']['collectedAt'], '2026-10-21T02:00:00Z')
            self.assertEqual(second['runStatus'], 'ok')

    def test_failed_expansion_keeps_legacy_hundred_rows_and_time(self):
        test_parent = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(prefix='.ugc-test-', dir=test_parent) as directory:
            root = Path(directory)
            legacy = {**self.first, 'id': 'cs2_alltime', 'boardType': 'alltime', 'boardLabel': '历史最热门',
                      'rankingKey': 'steam-cs2-map-lifetime-subscriptions-v1', 'rankingLimit': 100}
            ugc.atomic_json(root / 'data/ugc/latest.json', {'platforms': {'cs2_alltime': legacy}})
            result = ugc.publish(root, {}, {'cs2_alltime': 'HTTP 503'}, '2026-10-21', '2026-10-21T02:00:00Z', {'cs2_alltime'})
            retained = result['platforms']['cs2_alltime']
            self.assertEqual(retained['status'], 'stale')
            self.assertEqual(len(retained['entries']), 100)
            self.assertEqual(retained['collectedAt'], legacy['collectedAt'])


class Parsers(unittest.TestCase):
    def test_modrinth_top200_uses_two_real_pages(self):
        def hit(i):
            return {'project_type': 'mod', 'categories': [], 'project_id': str(i), 'title': 'Mod ' + str(i), 'slug': 'mod-' + str(i), 'downloads': 1000-i}
        pages = [json.dumps({'hits': [hit(i) for i in range(100)]}), json.dumps({'hits': [hit(i) for i in range(100,200)]})]
        with patch.object(ugc, 'request', side_effect=pages) as source:
            rows = ugc.collect_minecraft(True)
        self.assertEqual(len(rows), 200)
        self.assertEqual(rows[199]['id'], '199')
        self.assertIn('offset=100', source.call_args_list[1].args[0])

    def test_fortnite_filters_official_and_keeps_separate_metrics(self):
        source = "<a class='island' href='/island/battle-royale'><h3 class='island-title'>Official</h3></a>" + \
            "<a class='island' href='/island/1234-5678-9012'><h3 class='island-title'>Community</h3><div class='ccu'><span>Players Now</span> 1,200</div><div class='table-stat'><span>Minutes Played</span> 3.1B</div></a>"
        self.assertEqual(ugc.parse_fortnite(source)[0]['metricValue'], 1200)
        self.assertEqual(ugc.parse_fortnite(source, True)[0]['metricValue'], 3100000000)
        self.assertEqual(len(ugc.parse_fortnite(source)), 1)

    def test_steam_rejects_legacy_and_non_map_items(self):
        item = {'publishedfileid': '1', 'title': 'Map', 'consumer_appid': 730, 'subscriptions': 20, 'lifetime_subscriptions': 25,
                'tags': [{'tag': 'Cs2'}, {'tag': 'Map'}]}
        query = {'queryKey': ['workshop_browse', {'appid': 730, 'browse_sort': 'trend', 'required_tags': ['CS2']}],
                 'state': {'data': {'results': [item, {**item, 'publishedfileid': '2', 'tags': [{'tag': 'Map'}]}]}}}
        payload = {'loaderData': [json.dumps({'unrelated_featured': {**item, 'publishedfileid': '3'}, 'queries': [query]})]}
        source = '<script id="valve-ssr-data">' + json.dumps(payload) + '</script>'
        self.assertEqual(len(ugc.parse_steam(source)), 1)
        with self.assertRaises(ValueError):
            ugc.parse_steam(source, True)
        query['queryKey'][1]['browse_sort'] = 'totaluniquesubscribers'
        source = '<script id="valve-ssr-data">' + json.dumps({'queries': [query]}) + '</script>'
        self.assertEqual(ugc.parse_steam(source, True)[0]['metricValue'], 25)
        with self.assertRaises(ValueError):
            ugc.parse_steam('<html>Temporarily unavailable</html>')

    def test_rolimons_sorts_exact_visits(self):
        source = '<script>var games = ' + json.dumps({'1': {'name': 'A', 'visits': 10}, '2': {'name': 'B', 'visits': 50}}) + ';</script>'
        self.assertEqual(ugc.parse_rolimons(source)[0]['id'], '2')

    def test_short_metrics_and_zero(self):
        self.assertEqual(ugc.numeric('1.2M'), 1200000)
        self.assertEqual(ugc.numeric('0'), 0)
        self.assertIsNone(ugc.numeric('-2'))
        self.assertIsNone(ugc.numeric('unknown'))


class ChineseReview(unittest.TestCase):
    def test_fortnite_attribution_uses_island_author_not_navigation(self):
        from prepare_ugc_chinese import fetch_fortnite
        html = '<a href="/creators">All Creators</a><a href="/creator/the-author">The Author</a><div class="island-desc">Defend your base.</div>'
        with patch('prepare_ugc_chinese.request', return_value=html):
            source = fetch_fortnite({'id': '1234-5678-9012', 'title': 'Map', 'url': 'https://fortnite.gg/island/1234-5678-9012'})
        self.assertEqual(source['creator'], 'The Author')
        self.assertEqual(source['description'], 'Defend your base.')

    def test_steam_profile_must_match_requested_author(self):
        from prepare_ugc_chinese import steam_creator
        xml = '<profile><steamID64>76561197970363778</steamID64><steamID><![CDATA[A & B]]></steamID></profile>'
        with patch('prepare_ugc_chinese.request', return_value=xml):
            self.assertEqual(steam_creator('76561197970363778')['name'], 'A & B')
            with self.assertRaises(ValueError):
                steam_creator('76561198000000000')

    def test_roblox_group_credit_keeps_official_creator_name(self):
        from prepare_ugc_chinese import roblox_source
        source = roblox_source({'id': 100, 'rootPlaceId': 200, 'name': 'Game',
                               'creator': {'id': 300, 'name': 'Studio & Friends', 'type': 'Group'}})
        self.assertEqual(source['creator'], 'Studio & Friends')
        self.assertEqual(source['canonicalId'], '100')

    def test_restricted_roblox_placeholder_does_not_become_work_zero(self):
        from prepare_ugc_chinese import roblox_games
        with patch('prepare_ugc_chinese.request', return_value=json.dumps({'data': [
            {'id': 0, 'rootPlaceId': 0, 'isContentRestricted': True}, {'id': 5, 'rootPlaceId': 10}]})):
            self.assertEqual(roblox_games(['5', '6']), [{'id': 5, 'rootPlaceId': 10}])

    def test_unchanged_description_is_not_retranslated(self):
        from prepare_ugc_chinese import pending_entries, fingerprint
        source = {'title': 'Work', 'description': 'Gameplay', 'canonicalId': '1', 'sources': ['https://example.com']}
        catalog = {'entries': {'roblox:1': {'originalTitle': 'Work', 'sourceFingerprint': fingerprint('Work', 'Gameplay')}}}
        self.assertEqual(pending_entries({'roblox:1': {'title': 'Work'}}, {'roblox:1': source}, catalog), [])

    def test_changed_gameplay_or_name_requires_review_without_destroying_chinese(self):
        from prepare_ugc_chinese import pending_entries, fingerprint
        source = {'title': 'Work', 'description': 'New gameplay', 'canonicalId': '1', 'sources': ['https://example.com']}
        catalog = {'entries': {'roblox:1': {'title': '已审核中文', 'originalTitle': 'Work', 'sourceFingerprint': fingerprint('Work', 'Old gameplay')}}}
        queue = pending_entries({'roblox:1': {'title': 'Work'}}, {'roblox:1': source}, catalog)
        self.assertEqual(queue[0]['reason'], 'source_changed')
        self.assertEqual(catalog['entries']['roblox:1']['title'], '已审核中文')
        catalog['entries']['roblox:1']['sourceFingerprint'] = fingerprint('Work', 'New gameplay')
        self.assertEqual(len(pending_entries({'roblox:1': {'title': 'Renamed'}}, {'roblox:1': source}, catalog)), 1)

    def test_missing_source_and_null_description_are_explicit(self):
        from prepare_ugc_chinese import pending_entries, fingerprint
        queue = pending_entries({'roblox:1': {'title': 'Unknown'}}, {}, {})
        self.assertIn('不要根据名称猜写玩法', queue[0]['sourceError'])
        self.assertEqual(fingerprint('Work', None), fingerprint('Work', ''))


if __name__ == '__main__':
    unittest.main()
