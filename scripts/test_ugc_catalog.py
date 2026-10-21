#!/usr/bin/env python3
"""Focused offline tests for UGC catalog parsing and durable record semantics."""
import json
from datetime import datetime, timezone
from email.utils import format_datetime
from urllib.error import HTTPError
from io import BytesIO
from tempfile import TemporaryDirectory
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import sync_ugc_catalog as catalog


class CatalogTests(unittest.TestCase):
    def test_search_shard_path_tracks_its_own_content_hash(self):
        detail={'schemaVersion':1,'platformId':'cs2','entries':[{'key':'cs2:1','originalTitle':'Map'}]}
        search={'schemaVersion':1,'platformId':'cs2','entries':[{'key':'cs2:1','descriptionSearch':'short'}]}
        detail_a,search_a=catalog.immutable_shard_paths('cs2','00000',detail,search)
        changed={'schemaVersion':1,'platformId':'cs2','entries':[{'key':'cs2:1','descriptionSearch':'a longer projection'}]}
        detail_b,search_b=catalog.immutable_shard_paths('cs2','00000',detail,changed)
        self.assertEqual(detail_a,detail_b)
        self.assertNotEqual(search_a,search_b)

    def test_modrinth_pagination_url_keeps_catalog_scope_and_limit(self):
        url = catalog.board.modrinth_search_url(alltime=True, offset=700)
        self.assertIn('offset=700', url)
        self.assertIn('limit=100', url)
        self.assertIn('project_type%3Amod', url)
        self.assertIn('categories%21%3Dlibrary', url)

    def test_modrinth_anomaly_filter_preserves_raw_offset_and_counts_exclusions(self):
        original = catalog.public_request
        payload = {'total_hits': 5, 'hits': [
            {'project_type': 'mod', 'categories': [], 'project_id': 'good', 'slug': 'good', 'title': 'Good', 'description': 'x',
             'icon_url': None, 'featured_gallery': 'https://cdn.modrinth.com/data/a/cover.png'},
            {'project_type': 'mod', 'categories': [], 'project_id': 'gallery', 'slug': 'gallery', 'title': 'Gallery', 'description': 'x',
             'icon_url': None, 'featured_gallery': None, 'gallery': ['https://cdn.modrinth.com/data/b/cover.png']},
            {'project_type': 'mod', 'categories': [], 'project_id': 'invalid', 'slug': 'invalid', 'title': 'Invalid', 'description': 'x',
             'icon_url': None, 'featured_gallery': 'http://untrusted.example/a.png', 'gallery': []},
            {'project_type': 'mod', 'categories': [], 'project_id': 'icon', 'slug': 'icon', 'title': 'Icon', 'description': 'x',
             'icon_url': 'https://cdn.modrinth.com/data/c/icon.png', 'featured_gallery': 'https://cdn.modrinth.com/data/c/cover.png'},
            {'project_type': 'modpack', 'categories': [], 'project_id': 'bad', 'slug': 'bad', 'title': 'Bad'},
            {'project_type': 'mod', 'categories': ['library'], 'project_id': 'lib', 'slug': 'lib', 'title': 'Lib'}]}
        try:
            catalog.public_request = lambda *a, **k: json.dumps(payload)
            rows, total, url, raw_count, excluded, known = catalog.modrinth_page(10)
        finally:
            catalog.public_request = original
        self.assertEqual((total, raw_count, excluded, len(rows)), (5, 6, 2, 4))
        self.assertEqual(known, [])
        self.assertEqual(rows[0]['id'], 'good')
        self.assertEqual(rows[0]['imageUrl'], 'https://cdn.modrinth.com/data/a/cover.png')
        self.assertEqual(rows[0]['imageKind'], 'cover')
        self.assertEqual(rows[1]['imageUrl'], 'https://cdn.modrinth.com/data/b/cover.png')
        self.assertIsNone(rows[2]['imageUrl'])
        self.assertEqual(rows[3]['imageUrl'], 'https://cdn.modrinth.com/data/c/icon.png')
        self.assertEqual(rows[3]['imageKind'], 'icon')

    def test_modrinth_known_api_compatibility_layer_is_excluded_with_reason(self):
        original = catalog.public_request
        payload = {'total_hits':1,'hits':[{'project_type':'mod','categories':['utility'],
            'project_id':'ySnjMzLg','slug':'accessories-compat-layer','title':'Accessories Compatibility Layer',
            'description':"Modifies commonly used Accessory API's to work with Accessories, unifying a modpack under one Accessory API"}]}
        try:
            catalog.public_request=lambda *a,**k:json.dumps(payload)
            rows,total,url,raw_count,excluded,known=catalog.modrinth_page(0)
        finally:
            catalog.public_request=original
        self.assertEqual(rows,[])
        self.assertEqual((total,raw_count,excluded),(1,1,0))
        self.assertEqual(known,['minecraft:ySnjMzLg'])
        with TemporaryDirectory() as temp:
            state={'entries':{'minecraft:ySnjMzLg':{'key':'minecraft:ySnjMzLg'}},'excludedByTypeEventCount':0}
            catalog.register_known_exclusion(state,known[0])
            self.assertNotIn(known[0],state['entries'])
            self.assertEqual(state['excludedByTypeEventCount'],1)
            self.assertIn('modrinth.com',state['excludedRecords'][0]['sourceUrl'])

    def test_modrinth_cover_schema_prefers_icon_then_featured_then_gallery(self):
        self.assertEqual(catalog.modrinth_cover({'icon_url':'https://cdn.test/icon.png',
            'featured_gallery':'https://cdn.test/featured.png','gallery':['https://cdn.test/gallery.png']}),
            ('https://cdn.test/icon.png','icon'))
        self.assertEqual(catalog.modrinth_cover({'icon_url':None,
            'featured_gallery':'https://cdn.test/featured.png','gallery':['https://cdn.test/gallery.png']}),
            ('https://cdn.test/featured.png','cover'))
        self.assertEqual(catalog.modrinth_cover({'icon_url':None,
            'featured_gallery':'http://invalid.test/a.png','gallery':['https://cdn.test/gallery.png']}),
            ('https://cdn.test/gallery.png','cover'))
        self.assertEqual(catalog.modrinth_cover({'icon_url':None,'featured_gallery':None,'gallery':[]}), (None,None))

    def test_steam_parser_reads_source_totals_and_cover(self):
        payload = {'queryKey': ['workshop_browse', {'appid':730,'browse_sort':'totaluniquesubscribers','required_tags':['CS2']}],
                   'state': {'data': {'total_count':1,'total_pages':1,'results':[{'publishedfileid':'42','title':'Map',
                     'creator':'7656119','consumer_appid':730,'tags':[{'display_name':'CS2'},{'display_name':'Map'}],
                     'preview_url':'https://images.steamusercontent.com/a','subscriptions':5,'lifetime_subscriptions':9}]}}}
        source = '<script id="valve-ssr-data">' + json.dumps(payload) + '</script>'
        original_request, original_parse = catalog.public_request, catalog.board.parse_steam
        try:
            catalog.public_request = lambda *a, **k: source
            catalog.board.parse_steam = lambda *a, **k: [{'id':'42','title':'Map','creator':'7656119','url':'https://steamcommunity.com/sharedfiles/filedetails/?id=42','categories':[],'summary':'desc','metricValue':9,'publishedAt':None}]
            rows, total, pages, raw_count, raw_ids, excluded = catalog.steam_page(1)
        finally:
            catalog.public_request = original_request
            catalog.board.parse_steam = original_parse
        self.assertEqual((total, pages, raw_count), (1,1,1))
        self.assertEqual(rows[0]['imageUrl'], 'https://images.steamusercontent.com/a')
        self.assertEqual(raw_ids, ['42'])
        self.assertEqual(excluded, [])

    def test_steam_filtered_empty_page_still_has_raw_candidates(self):
        self.assertTrue(catalog.steam_page_has_more_candidates(['excluded'], 1, 5))
        self.assertFalse(catalog.steam_page_has_more_candidates([], 1, 5))
        self.assertFalse(catalog.steam_page_has_more_candidates(['x'], 5, 5))

    def test_steam_explicit_playermodel_is_excluded_but_generic_model_is_not(self):
        self.assertTrue(catalog.is_non_map_work({'title': '(FIXED) Server-side TokaiTeio Playermodel'}))
        self.assertFalse(catalog.is_non_map_work({'title': 'Model of Ancient Ruins Map'}))
        self.assertTrue(catalog.is_non_map_work({'title': 'xplay.gg | Assets', 'description': 'A resource pack with 16 game modes and score assets.'}))
        self.assertTrue(catalog.is_non_map_work({'title': 'CYBERSHOKE Assets', 'description': ''}))
        self.assertFalse(catalog.is_non_map_work({'title': 'Ancient Assets', 'description': 'Explore a map full of ancient assets.'}))

    def test_cs2_chinese_resource_packs_and_verified_menu_audio_assets_are_excluded_narrowly(self):
        self.assertTrue(catalog.is_non_map_work({'id':'3778069716','title':'资源包EXG ZE'}))
        self.assertFalse(catalog.is_non_map_work({'id':'3810054981','title':'菜单与音频资源'}))
        self.assertFalse(catalog.is_non_map_work({'id':'123','title':'资源争夺地图'}))
        self.assertFalse(catalog.is_non_map_work({'id':'124','title':'资源丰富的生存地图'}))
        state={'entries':{'cs2:3778069716':{'key':'cs2:3778069716','originalTitle':'资源包EXG ZE',
            'descriptionOriginal':'服务器资源包','sourceFingerprint':'old-fp','url':'https://steamcommunity.com/sharedfiles/filedetails/?id=3778069716',
            'image':{'url':'https://images.steamusercontent.com/cover.png'},'firstObservedAt':'2026-01-01T00:00:00Z'},
            'cs2:3810054981':{'key':'cs2:3810054981','originalTitle':'菜单与音频资源',
            'descriptionOriginal':'服务器附加菜单与音频服务','url':'https://steamcommunity.com/sharedfiles/filedetails/?id=3810054981'},
            'cs2:123':{'key':'cs2:123','originalTitle':'资源争夺地图','descriptionOriginal':'争夺地图资源'}}}
        self.assertTrue(catalog.register_cs2_exclusion(state,'cs2:3778069716',{'id':'3778069716'},state['entries']['cs2:3778069716']))
        self.assertEqual(state['excludedByTypeEventCount'],1)
        saved=state['excludedRecords'][0]
        self.assertEqual(saved['originalTitle'],'资源包EXG ZE')
        self.assertEqual(saved['descriptionOriginal'],'服务器资源包')
        self.assertEqual(saved['evidence']['image']['url'],'https://images.steamusercontent.com/cover.png')
        self.assertFalse(catalog.register_cs2_exclusion(state,'cs2:3778069716',{'id':'3778069716'}))
        self.assertEqual(state['excludedByTypeEventCount'],1)

    def test_approved_type_exclusion_requires_approval_and_exact_fingerprint(self):
        original={name:getattr(catalog,name) for name in ('ROOT','CACHE','CATALOG','TRANSLATIONS')}
        try:
            with TemporaryDirectory() as temp:
                root=Path(temp); catalog.ROOT=root; catalog.CACHE=root/'data/ugc/catalog-cache'; catalog.CATALOG=root/'data/ugc/catalog'
                catalog.CACHE.mkdir(parents=True); catalog.CATALOG.mkdir(parents=True); catalog.TRANSLATIONS={}
                key='cs2:4242'; title='Widget'; old_desc='This is a map'; full_desc='This is a map with two bombsites.'
                rule={'sourceFingerprint':catalog.fingerprint(title,old_desc),'originalTitle':title,
                    'descriptionOriginal':old_desc,'reason':'unapproved draft exclusion','sources':['https://example.test/item'],
                    'reviewedAt':'2026-01-01T00:00:00Z','reviewer':'reviewer'}
                config=root/'data/ugc/catalog-exclusions.json'; config.parent.mkdir(parents=True,exist_ok=True)
                config.write_text(json.dumps({'schemaVersion':1,'entries':{key:rule}}),encoding='utf-8')
                self.assertEqual(catalog.load_approved_type_exclusions(),{})
                entry=catalog.make_entry('cs2',{'id':'4242','title':title,'url':'https://steamcommunity.com/sharedfiles/filedetails/?id=4242'},'This is a map')
                state={'entries':{key:entry},'excludedByTypeEventCount':0}
                self.assertEqual(catalog.apply_approved_type_exclusions('cs2',state),0)
                self.assertIn(key,state['entries'])

                rule['approval']={'approvedBy':'primary-agent','approvedAt':'2026-01-02T00:00:00Z'}
                config.write_text(json.dumps({'schemaVersion':1,'entries':{key:rule}}),encoding='utf-8')
                evidence=root/'data/ugc/source-descriptions.json'; evidence.parent.mkdir(parents=True,exist_ok=True)
                evidence.write_text(json.dumps({'entries':{key:{'title':title,'description':full_desc,'fullDescription':True,
                    'sources':['https://example.test/full']}}}),encoding='utf-8')
                (evidence.parent/'creators.json').write_text('{"entries":{}}',encoding='utf-8')
                entry['descriptionOriginal']='This is a map'
                entry['sourceFingerprint']=catalog.fingerprint(title,'This is a map')
                state={'platformId':'cs2','entries':{key:entry},'excludedByTypeEventCount':0,'progress':{},'status':'complete'}
                catalog.write_platform('cs2',state)
                self.assertIn(key,state['entries'])
                self.assertEqual(state['entries'][key]['descriptionOriginal'],full_desc)
                self.assertEqual(state['excludedByTypeEventCount'],0)
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_approved_type_exclusion_matches_after_evidence_completion_and_is_idempotent(self):
        original={name:getattr(catalog,name) for name in ('ROOT','CACHE','CATALOG','TRANSLATIONS')}
        try:
            with TemporaryDirectory() as temp:
                root=Path(temp); catalog.ROOT=root; catalog.CACHE=root/'data/ugc/catalog-cache'; catalog.CATALOG=root/'data/ugc/catalog'
                catalog.CACHE.mkdir(parents=True); catalog.CATALOG.mkdir(parents=True); catalog.TRANSLATIONS={}
                key='cs2:4242'; title='Widget'; teaser='This package is'; full='This package is a server-side HUD plugin, not a map.'
                approved={'sourceFingerprint':catalog.fingerprint(title,full),'originalTitle':title,'descriptionOriginal':full,
                    'reason':'Verified by source description as server UI dependency.','sources':['https://example.test/item'],
                    'reviewedAt':'2026-01-01T00:00:00Z','reviewer':'reviewer',
                    'approval':{'approvedBy':'primary-agent','approvedAt':'2026-01-02T00:00:00Z'}}
                config=root/'data/ugc/catalog-exclusions.json'; config.parent.mkdir(parents=True,exist_ok=True)
                config.write_text(json.dumps({'schemaVersion':1,'entries':{key:approved}}),encoding='utf-8')
                data=root/'data/ugc'; data.mkdir(parents=True,exist_ok=True)
                (data/'source-descriptions.json').write_text(json.dumps({'entries':{key:{'title':title,'description':full,
                    'fullDescription':True,'sources':['https://example.test/full']}}}),encoding='utf-8')
                (data/'creators.json').write_text('{"entries":{}}',encoding='utf-8')
                entry=catalog.make_entry('cs2',{'id':'4242','title':title,'url':'https://steamcommunity.com/sharedfiles/filedetails/?id=4242'},teaser)
                entry['descriptionOriginal']=teaser; entry['sourceFingerprint']=catalog.fingerprint(title,teaser)
                first='2025-01-01T00:00:00Z'; entry['firstObservedAt']=first
                state={'platformId':'cs2','entries':{key:entry},'excludedByTypeEventCount':0,'progress':{},'status':'complete'}
                catalog.write_platform('cs2',state)
                self.assertNotIn(key,state['entries'])
                self.assertEqual(state['excludedByTypeEventCount'],1)
                evidence=state['excludedRecords'][0]['originalEntry']
                self.assertEqual(evidence['descriptionOriginal'],full)
                self.assertEqual(evidence['firstObservedAt'],first)
                self.assertEqual(evidence['sourceFingerprint'],approved['sourceFingerprint'])
                public_record=catalog.platform_manifest('cs2',state)['exclusionRecords'][0]
                self.assertEqual(public_record['key'],key)
                self.assertEqual(public_record['sources'],approved['sources'])
                self.assertNotIn('descriptionOriginal',public_record)
                self.assertNotIn('originalEntry',public_record)
                catalog.write_platform('cs2',state)
                self.assertEqual(state['excludedByTypeEventCount'],1)
                self.assertEqual(len(state['excludedRecords']),1)
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_approved_exclusion_upgrades_legacy_private_evidence(self):
        original={name:getattr(catalog,name) for name in ('ROOT','CACHE','CATALOG')}
        try:
            with TemporaryDirectory() as temp:
                root=Path(temp); catalog.ROOT=root; catalog.CACHE=root/'data/ugc/catalog-cache'; catalog.CATALOG=root/'data/ugc/catalog'
                catalog.CACHE.mkdir(parents=True); catalog.CATALOG.mkdir(parents=True)
                key='cs2:4243'; title='Old package'; desc='A verified server-side UI package.'; fp=catalog.fingerprint(title,desc)
                rule={'sourceFingerprint':fp,'originalTitle':title,'descriptionOriginal':desc,'reason':'Confirmed package.',
                    'sources':['https://example.test/item'],'reviewedAt':'2026-01-01T00:00:00Z','reviewer':'reviewer',
                    'approval':{'approvedBy':'primary-agent','approvedAt':'2026-01-02T00:00:00Z'}}
                (root/'data/ugc').mkdir(parents=True,exist_ok=True)
                (root/'data/ugc/catalog-exclusions.json').write_text(json.dumps({'schemaVersion':1,'entries':{key:rule}}),encoding='utf-8')
                old_entry={'key':key,'originalTitle':title,'descriptionOriginal':desc,'sourceFingerprint':fp,
                    'firstObservedAt':'2025-01-01T00:00:00Z','image':{'url':'https://example.test/cover.png','status':'available'}}
                state={'platformId':'cs2','entries':{},'excludedRecords':[{'key':key,'sourceFingerprint':fp,
                    'evidence':old_entry,'excludedAt':'2026-01-03T00:00:00Z'}]}
                self.assertEqual(catalog.apply_approved_type_exclusions('cs2',state),0)
                record=state['excludedRecords'][0]
                self.assertEqual(record['originalEntry'],old_entry)
                self.assertEqual(record['approval'],rule['approval'])
                self.assertEqual(record['excludedAt'],'2026-01-03T00:00:00Z')
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_crosshair_and_hud_map_titles_are_not_mistaken_for_mods(self):
        self.assertFalse(catalog.is_non_map_work({'title': 'crashz Crosshair Generator'}))
        self.assertFalse(catalog.is_non_map_work({'title': 'Crosshairs of PRO Players map'}))
        self.assertFalse(catalog.is_non_map_work({'title': 'HUD training arena'}))
        self.assertTrue(catalog.is_non_map_work({'title': 'HUD Replacement mod'}))
        self.assertTrue(catalog.is_non_map_work({'title': 'Crosshair pack'}))

    def test_metric_labels_and_catalog_order_use_per_platform_metric(self):
        self.assertEqual(catalog.METRIC_LABELS['roblox'], '累计访问次数')
        self.assertEqual(catalog.METRIC_LABELS['minecraft'], '累计下载次数')
        self.assertEqual(catalog.METRIC_LABELS['fortnite'], '当前在线人数')
        rows = [{'key':'x:low','originalTitle':'A','metricValue':1},
                {'key':'x:high','originalTitle':'B','metricValue':20},
                {'key':'x:none','originalTitle':'0','metricValue':None}]
        self.assertEqual([x['key'] for x in catalog.catalog_order(rows)], ['x:high','x:low','x:none'])

    def test_manifest_never_claims_candidate_difference_as_excluded_count(self):
        manifest = catalog.platform_manifest('cs2', {'entries':{'cs2:1':{}},'enumerationComplete':True,
            'candidateCount':10,'reportedTotal':10,'observedCount':1,'excludedByTypeEventCount':3})
        self.assertIsNone(manifest['excludedCount'])
        self.assertEqual(manifest['candidateObservationDifference'],9)
        self.assertEqual(manifest['excludedByTypeEventCount'],3)
        minecraft = catalog.platform_manifest('minecraft', {'entries':{},'enumerationComplete':True,
            'reportedTotal':73963,'observedCount':73919})
        self.assertEqual(minecraft['candidateObservationDifference'],44)

    def test_refresh_resets_cursor_but_preserves_old_records(self):
        state = {'entries': {'cs2:old': {'key': 'cs2:old'}}, 'progress': {'nextPage': 99},
                 'enumerationComplete': True, 'status': 'complete', 'reportedTotal': 10}
        catalog.reset_for_refresh(state)
        self.assertEqual(state['progress']['nextPage'], 1)
        self.assertFalse(state['enumerationComplete'])
        self.assertIn('cs2:old', state['entries'])

    def test_accepted_review_requires_matching_fingerprint_and_provenance(self):
        original = catalog.CACHE
        try:
          with TemporaryDirectory() as temp:
            catalog.CACHE = Path(temp) / 'catalog-cache'
            accepted = catalog.CACHE / 'reviews/accepted'
            accepted.mkdir(parents=True, exist_ok=True)
            entry = catalog.make_entry('cs2', {'id': '7', 'title': 'Map', 'url': 'https://steamcommunity.com/sharedfiles/filedetails/?id=7'}, 'source details')
            payload = {'schemaVersion': 1, 'acceptance': {'approvedBy': 'primary-agent', 'approvedAt': catalog.now()}, 'entries': [{'key': entry['key'], 'titleZh': '地图', 'introZh': '这是玩法介绍。',
                'sources': entry['sources'], 'sourceFingerprint': entry['sourceFingerprint'], 'reviewedAt': catalog.now(), 'reviewer': 'reviewer'}]}
            catalog.atomic_json(accepted / 'batch.json', payload)
            catalog.apply_accepted_reviews({entry['key']: entry})
            self.assertEqual(entry['translationStatus'], 'reviewed')
            self.assertEqual(entry['reviewer'], 'reviewer')
            self.assertEqual(entry['reviewApproval']['status'], 'accepted')
            changed = dict(entry, sourceFingerprint='0' * 64, translationStatus='pending', titleZh='', introZh='')
            catalog.apply_accepted_reviews({changed['key']: changed})
            self.assertEqual(changed['translationStatus'], 'pending')
        finally:
            catalog.CACHE = original

    def test_normalize_existing_preserves_review_metadata_only_for_same_fingerprint(self):
        old = {'firstObservedAt':'2020-01-01T00:00:00+00:00','sourceFingerprint':'same',
               'translationStatus':'reviewed','titleZh':'已审标题','introZh':'已审介绍',
               'reviewer':'reviewer','reviewedAt':'2025-01-01T00:00:00Z','reviewSources':['https://source.test/'],
               'reviewApproval':{'status':'accepted','approvedBy':'primary-agent','approvedAt':'2025-01-02T00:00:00Z'}}
        same = catalog.normalize_existing(old, {'firstObservedAt':'new','sourceFingerprint':'same','translationStatus':'pending'})
        self.assertEqual(same['firstObservedAt'], old['firstObservedAt'])
        self.assertEqual(same['reviewApproval'], old['reviewApproval'])
        self.assertEqual(same['reviewedAt'], old['reviewedAt'])
        changed = catalog.normalize_existing(old, {'firstObservedAt':'new','sourceFingerprint':'changed','translationStatus':'pending'})
        self.assertEqual(changed['translationStatus'], 'pending')
        self.assertNotIn('reviewApproval', changed)
        self.assertNotIn('reviewer', changed)

    def test_public_accepted_translation_overrides_stale_chinese_fingerprint(self):
        names = ('ROOT','CATALOG','TRANSLATIONS')
        original = {name:getattr(catalog,name) for name in names}
        try:
            with TemporaryDirectory() as temp:
                catalog.ROOT = Path(temp); catalog.CATALOG = Path(temp)/'data/ugc/catalog'; catalog.TRANSLATIONS = None
                (Path(temp)/'data/ugc').mkdir(parents=True)
                old = {'key':'cs2:42','title':'旧中文','intro':'旧介绍','sourceFingerprint':'0'*64,
                       'reviewedAt':'2025-01-01T00:00:00Z','sources':['https://source.test/']}
                (Path(temp)/'data/ugc/chinese.json').write_text(json.dumps({'entries':{'cs2:42':old}}),encoding='utf-8')
                shard = 'data/ugc/catalog/cs2/recovered.json'; shard_path=Path(temp)/shard; shard_path.parent.mkdir(parents=True)
                fp = catalog.fingerprint('Map','source description')
                accepted = {'key':'cs2:42','translationStatus':'reviewed','titleZh':'新中文','introZh':'新介绍',
                    'sourceFingerprint':fp,'reviewedAt':'2026-01-01T00:00:00Z','reviewer':'reviewer',
                    'reviewApproval':{'status':'accepted','approvedBy':'primary-agent','approvedAt':'2026-01-02T00:00:00Z'}}
                shard_path.write_text(json.dumps({'entries':[accepted]}),encoding='utf-8')
                catalog.CATALOG.mkdir(parents=True,exist_ok=True)
                (catalog.CATALOG/'manifest.json').write_text(json.dumps({'platforms':{'cs2':{'shards':[{'url':shard}]}}}),encoding='utf-8')
                entry = {'key':'cs2:42','platformId':'cs2','canonicalId':None,'sourceFingerprint':fp,'sources':[]}
                catalog.apply_reviewed(entry)
                self.assertEqual(entry['titleZh'],'新中文')
                self.assertEqual(entry['reviewApproval']['approvedBy'],'primary-agent')
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_roblox_refresh_prefers_latest_verified_content_and_keeps_first_seen(self):
        names = ('ROOT','CATALOG','CACHE','SOURCE_EVIDENCE','TRANSLATIONS')
        original = {name:getattr(catalog,name) for name in names}
        try:
            with TemporaryDirectory() as temp:
                root=Path(temp); catalog.ROOT=root; catalog.CATALOG=root/'catalog'; catalog.CACHE=root/'cache'
                catalog.CATALOG.mkdir(); catalog.CACHE.mkdir(); catalog.TRANSLATIONS={}
                evidence_dir=root/'data/ugc'; evidence_dir.mkdir(parents=True)
                official={'title':'Official New Name','description':'New official description','fullDescription':True,
                          'canonicalId':'9001','creator':'Studio','sources':['https://games.roblox.com/v1/games?universeIds=9001']}
                (evidence_dir/'source-descriptions.json').write_text(json.dumps({'entries':{'roblox:9001':official}}),encoding='utf-8')
                (evidence_dir/'creators.json').write_text('{"entries":{}}',encoding='utf-8')
                catalog.atomic_json(catalog.CACHE/'roblox-identities.json',{'entries':{'101':{'universeId':'9001'}}})
                old=catalog.make_entry('roblox',{'id':'9001','title':'Old Name','url':'https://www.roblox.com/games/101'},'Old description','https://tr.rbxcdn.com/old','icon')
                old.update({'key':'roblox:9001','id':'9001','canonicalId':'9001','placeId':'101','sourceIds':['101'],
                            'identityStatus':'verified','firstObservedAt':'2020-01-01T00:00:00Z','lastObservedAt':'2025-01-01T00:00:00Z'})
                fresh=catalog.make_entry('roblox',{'id':'101','title':'New source name','url':'https://www.roblox.com/games/101','metricValue':20},'Cached teaser','https://tr.rbxcdn.com/new','icon',identity_status='pending')
                fresh.update({'placeId':'101','lastObservedAt':'2026-01-01T00:00:00Z'})
                state={'entries':{'roblox:9001':old,'roblox:place:101':fresh},'status':'complete','progress':{'done':True}}
                catalog.write_platform('roblox',state)
                self.assertEqual(list(state['entries']),['roblox:9001'])
                entry=state['entries']['roblox:9001']
                self.assertEqual(entry['originalTitle'],'Official New Name')
                self.assertEqual(entry['descriptionOriginal'],'New official description')
                self.assertEqual(entry['firstObservedAt'],'2020-01-01T00:00:00Z')
                self.assertEqual(entry['translationStatus'],'pending')
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_collection_freshness_timestamps_change_only_after_real_success(self):
        original = {name:getattr(catalog,name) for name in ('load_state','save_state','write_platform','roblox_rows','merge_page')}
        try:
            state={'platformId':'roblox','entries':{},'progress':{},'enumerationComplete':False,'status':'partial','errors':[],
                   'nextAttemptAt':'2000-01-01T00:00:00Z'}
            catalog.load_state=lambda platform:state
            catalog.save_state=lambda value:None
            catalog.write_platform=lambda platform,value:None
            catalog.roblox_rows=lambda:([],0)
            catalog.merge_page=lambda *args:None
            first=catalog.collect_one('roblox',__import__('time').monotonic()+10,0)
            initial_complete=first['enumerationCompletedAt']; initial_attempt=first['lastAttemptAt']
            catalog.collect_one('roblox',__import__('time').monotonic()+10,0)
            self.assertEqual(first['lastAttemptAt'],initial_attempt)
            self.assertEqual(first['enumerationCompletedAt'],initial_complete)
            __import__('time').sleep(1.05)
            catalog.collect_one('roblox',__import__('time').monotonic()+10,0,refresh=True)
            self.assertGreaterEqual(first['enumerationCompletedAt'],initial_complete)
            self.assertNotEqual(first['lastAttemptAt'],initial_attempt)
            self.assertTrue(first.get('lastSuccessfulAt'))
            self.assertNotIn('nextAttemptAt',first)
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_future_backoff_skips_source_and_cover_requests(self):
        now=__import__('datetime').datetime.now(__import__('datetime').timezone.utc)
        future=(now+__import__('datetime').timedelta(hours=1)).isoformat()
        state={'platformId':'roblox','entries':{},'progress':{},'enumerationComplete':False,'status':'partial',
               'errors':[],'nextAttemptAt':future}
        originals={name:getattr(catalog,name) for name in ('load_state','save_state','write_platform','roblox_rows','merge_page','public_request')}
        old_deadline,old_next=catalog.CURRENT_DEADLINE,catalog.NEXT_ATTEMPT_AT
        try:
            catalog.load_state=lambda platform:state
            catalog.save_state=lambda value:None
            catalog.write_platform=lambda platform,value:None
            catalog.roblox_rows=lambda:(_ for _ in ()).throw(AssertionError('source request should be skipped'))
            catalog.merge_page=lambda *args:None
            result=catalog.collect_one('roblox',__import__('time').monotonic()+10,0)
            self.assertEqual(result['lastAttemptAt'] if 'lastAttemptAt' in result else None,None)
            self.assertEqual(result['nextAttemptAt'],future)
            self.assertEqual(result['status'],'limited')

            cover_state={'entries':{'minecraft:x':{'key':'minecraft:x','id':'x','url':'https://modrinth.com/mod/x',
                'image':{'url':None,'status':'missing'},'coverLookupAt':None}},'coverNextAttemptAt':future}
            catalog.load_state=lambda platform:cover_state
            catalog.public_request=lambda *a,**k:(_ for _ in ()).throw(AssertionError('cover request should be skipped'))
            self.assertEqual(catalog.process_modrinth_covers(__import__('time').monotonic()+10),0)
            self.assertEqual(cover_state['coverNextAttemptAt'],future)
            cover_state['coverNextAttemptAt']=(now-__import__('datetime').timedelta(hours=1)).isoformat()
            catalog.public_request=lambda *a,**k:'[]'
            catalog.process_modrinth_covers(__import__('time').monotonic()+10)
            self.assertNotIn('coverNextAttemptAt',cover_state)
            self.assertTrue(cover_state['entries']['minecraft:x'].get('coverLookupAt'))
        finally:
            for name,value in originals.items():setattr(catalog,name,value)
            catalog.CURRENT_DEADLINE,catalog.NEXT_ATTEMPT_AT=old_deadline,old_next

    def test_roblox_unverified_place_does_not_claim_universe_identity(self):
        row = {'id':'1818','title':'Crossroads','url':'https://www.roblox.com/games/1818','imageUrl':'https://tr.rbxcdn.com/cover','identityStatus':'pending'}
        entry = catalog.make_entry('roblox', row, image_url=row['imageUrl'], identity_status='pending')
        self.assertIsNone(entry['canonicalId'])
        self.assertEqual(entry['identityStatus'], 'pending')
        self.assertEqual(entry['image']['status'], 'available')

    def test_source_fingerprint_tracks_actual_description(self):
        self.assertNotEqual(catalog.fingerprint('A','real description'), catalog.fingerprint('A','changed description'))

    def test_shards_split_at_record_cap_and_reject_single_oversize_record(self):
        rows = [{'key': f'minecraft:{i}', 'descriptionOriginal': 'x'} for i in range(401)]
        chunks = catalog.chunk_entries('minecraft', rows)
        self.assertEqual([len(chunk) for chunk in chunks], [400, 1])
        with self.assertRaises(ValueError):
            catalog.chunk_entries('minecraft', [{'key': 'minecraft:huge', 'descriptionOriginal': 'x' * catalog.MAX_FILE_BYTES}])

    def test_missing_cover_is_countable_not_fabricated(self):
        entry = catalog.make_entry('minecraft', {'id':'x','title':'Mod','url':'https://modrinth.com/mod/x'})
        self.assertIsNone(entry['image']['url'])
        self.assertEqual(entry['image']['status'], 'missing')
        self.assertEqual(catalog.normalize_cover_url('../image.png', 'https://fortnite.gg/creative?page=1'), 'https://fortnite.gg/image.png')

    def test_board_cover_survives_directory_exclusion_from_evidence_or_previous_index(self):
        original={name:getattr(catalog,name) for name in ('ROOT','CATALOG','CACHE','load_state')}
        try:
            with TemporaryDirectory() as temp:
                root=Path(temp); catalog.ROOT=root; catalog.CATALOG=root/'data/ugc/catalog'; catalog.CACHE=root/'data/ugc/catalog-cache'
                catalog.CATALOG.mkdir(parents=True); catalog.CACHE.mkdir(parents=True)
                data_dir=root/'data/ugc'; data_dir.mkdir(parents=True,exist_ok=True)
                evidence_cover={'url':'https://images.steamusercontent.com/excluded.png','sourceUrl':'https://steamcommunity.com/sharedfiles/filedetails/?id=1001',
                    'kind':'cover','status':'available','checkedAt':'2026-01-01T00:00:00Z'}
                old_cover={'url':'https://images.steamusercontent.com/old-board.png','sourceUrl':'https://steamcommunity.com/sharedfiles/filedetails/?id=1002',
                    'kind':'cover','status':'available','checkedAt':'2025-12-31T00:00:00Z'}
                (data_dir/'latest.json').write_text(json.dumps({'platforms':{'cs2':{'platformId':'cs2','entries':[{'id':'1001'},{'id':'1002'}]}}}),encoding='utf-8')
                (catalog.CATALOG/'board-covers.json').write_text(json.dumps({'entries':{'cs2:1002':old_cover}}),encoding='utf-8')
                states={p:{'entries':{},'excludedRecords':[]} for p in catalog.PLATFORMS}
                states['cs2']['excludedRecords']=[{'key':'cs2:1001','originalEntry':{'image':evidence_cover}}]
                catalog.load_state=lambda platform:states[platform]
                catalog.write_board_covers()
                result=json.loads((catalog.CATALOG/'board-covers.json').read_text(encoding='utf-8'))['entries']
                self.assertEqual(result['cs2:1001'],evidence_cover)
                self.assertEqual(result['cs2:1002'],old_cover)
        finally:
            for name,value in original.items():setattr(catalog,name,value)

    def test_roblox_same_verified_universe_uses_canonical_key(self):
        names = ('ROOT', 'CATALOG', 'CACHE', 'SOURCE_EVIDENCE', 'TRANSLATIONS')
        original = {name: getattr(catalog, name) for name in names}
        try:
          with TemporaryDirectory() as temp:
            root = Path(temp)
            catalog.ROOT, catalog.CATALOG, catalog.CACHE = root, root / 'catalog', root / 'cache'
            catalog.CATALOG.mkdir(); catalog.CACHE.mkdir()
            for path in ('data/ugc/source-descriptions.json', 'data/ugc/creators.json'):
                target = root / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_text('{"entries":{}}', encoding='utf-8')
            catalog.atomic_json(catalog.CACHE / 'roblox-identities.json', {'entries': {'101': {'universeId': '9001'}, '102': {'universeId': '9001'}}})
            entries = {}
            for place in ('101', '102'):
                row = {'id': place, 'title': f'Place {place}', 'url': f'https://www.roblox.com/games/{place}', 'creator': '', 'summary': '', 'sourceUrls': []}
                item = catalog.make_entry('roblox', row, '', 'https://tr.rbxcdn.com/icon', 'icon', identity_status='pending')
                item['placeId'] = place
                entries[item['key']] = item
            state = {'entries': entries, 'status': 'partial', 'progress': {}}
            catalog.write_platform('roblox', state)
            self.assertEqual(list(state['entries']), ['roblox:9001'])
            self.assertCountEqual(state['entries']['roblox:9001']['sourceIds'], ['101', '102'])
        finally:
            for name, value in original.items(): setattr(catalog, name, value)

    def test_retry_after_date_is_not_truncated(self):
        target = datetime.now(timezone.utc).timestamp() + 3600
        parsed = format_datetime(datetime.fromtimestamp(target, timezone.utc), usegmt=True)
        wait = max(0, (catalog.parsedate_to_datetime(parsed) - datetime.now(timezone.utc)).total_seconds())
        self.assertGreater(wait, 3500)

    def test_retry_after_beyond_deadline_records_resume_time_without_early_retry(self):
        original_urlopen, original_deadline, original_next = catalog.urlopen, catalog.CURRENT_DEADLINE, catalog.NEXT_ATTEMPT_AT
        try:
            def limited(*args, **kwargs):
                raise HTTPError('https://example.test', 429, 'slow down', {'Retry-After': '3600'}, BytesIO())
            catalog.urlopen = limited
            catalog.CURRENT_DEADLINE = __import__('time').monotonic() + 0.1
            catalog.NEXT_ATTEMPT_AT = None
            with self.assertRaises(TimeoutError): catalog.public_request('https://example.test')
            self.assertGreater(catalog.NEXT_ATTEMPT_AT - __import__('time').time(), 3500)
        finally:
            catalog.urlopen, catalog.CURRENT_DEADLINE, catalog.NEXT_ATTEMPT_AT = original_urlopen, original_deadline, original_next

    def test_windows_lock_inspection_never_calls_os_kill_and_retains_live_collector(self):
        with TemporaryDirectory() as temp:
            lock = Path(temp) / '.sync.lock'
            lock.write_text(json.dumps({'pid': 123, 'command': 'sync_ugc_catalog.py'}), encoding='utf-8')
            response = SimpleNamespace(returncode=0, stdout='__PID_EXISTS__\npython sync_ugc_catalog.py\n', stderr='')
            with patch.object(catalog.os, 'name', 'nt'), patch.object(catalog.subprocess, 'run', return_value=response), patch.object(catalog.os, 'kill') as kill:
                with self.assertRaises(SystemExit): catalog.acquire_lock(lock)
                kill.assert_not_called()
            self.assertTrue(lock.exists())

    def test_windows_lock_inspection_removes_only_cim_confirmed_dead_pid(self):
        with TemporaryDirectory() as temp:
            lock = Path(temp) / '.sync.lock'
            lock.write_text(json.dumps({'pid': 123, 'command': 'sync_ugc_catalog.py'}), encoding='utf-8')
            response = SimpleNamespace(returncode=0, stdout='__PID_MISSING__\n', stderr='')
            with patch.object(catalog.os, 'name', 'nt'), patch.object(catalog.subprocess, 'run', return_value=response), patch.object(catalog.os, 'kill') as kill:
                catalog.acquire_lock(lock)
                kill.assert_not_called()
            self.assertEqual(json.loads(lock.read_text(encoding='utf-8'))['pid'], __import__('os').getpid())


if __name__ == '__main__':
    unittest.main()
