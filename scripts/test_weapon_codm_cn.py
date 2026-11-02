"""Regression boundaries for the official CODM article importer (no network)."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import sync_weapon_codm_cn as importer


class BlueprintArticleTests(unittest.TestCase):
    def setUp(self):
        self.aliases = importer.weapons({'skins': [
            {'id': 'codm-m13-example', 'weaponId': 'm13', 'weaponName': 'M13',
             'weaponType': 'gun', 'category': '突击步枪'},
            {'id': 'codm-krm-example', 'weaponId': 'krm-262', 'weaponName': 'KRM-262',
             'weaponType': 'gun', 'category': '霰弹枪'},
        ]})

    def parse(self, body, url='https://codm.qq.com/gicp/news/887/1.html'):
        return importer.parse_article({'url': url, 'retrievedAt': '2026-11-03T00:00:00Z',
            'html': '<div class="art-info">使命召唤手游 2026-10-01</div>'
                    '<div class="art-main">' + body + '</div>'}, self.aliases)[0]

    def test_blueprint_heading_is_not_a_mixed_promotion(self):
        for name in ['M13-黑耀星辰、KRM262-电玩高手', 'M13-黑耀星辰再度降临',
                     'M13-黑耀星辰现已登场', 'M13-黑耀星辰碎片上新']:
            with self.subTest(name=name):
                self.assertIsNone(importer.named_weapon(name, self.aliases))

    def test_native_weapon_requires_an_adjacent_standalone_weapon_label(self):
        self.assertEqual(self.parse('<h2>新枪-银河</h2><img src="https://shp.qpic.cn/test">'), [])
        rows = self.parse('<h2>传说级武器</h2><h3>新枪-银河</h3><img src="https://shp.qpic.cn/test">')
        self.assertEqual(rows[0]['base']['name'], '新枪')

    def test_character_declaration_cannot_become_weapon_from_nearby_label(self):
        rows = self.parse('<h2>史诗级武器</h2><h3>妖狐-猎妖大师</h3>'
                          '<img src="https://shp.qpic.cn/character"><p>角色皮肤：妖狐-猎妖大师</p>')
        self.assertEqual(rows, [])

    def test_native_melee_does_not_default_to_gun(self):
        for weapon in ['爪刀', '军用斧', '战术近战', '荧光棒', '龙泉剑', '扇', '蛇刃']:
            with self.subTest(weapon=weapon):
                self.assertEqual(importer.named_weapon(weapon + '-银河', self.aliases)[0]['type'], 'melee')

    def test_inspect_does_not_leak_into_reactive_body_or_reward_section(self):
        rows = self.parse('<h2>M13-黑耀星辰</h2><h3>专属检视动作</h3>'
            '<p>当持有者检视这把武器时，零件将会重组。</p><img src="https://shp.qpic.cn/inspect">'
            '<h3>专属枪身特效</h3><p>累计消灭2名敌人时，护板张开。</p><img src="https://shp.qpic.cn/body">'
            '<h3>超值返利活动</h3><img src="https://shp.qpic.cn/reward">')
        self.assertEqual([(p['url'].rsplit('/', 1)[-1], p['action']) for p in rows[0]['images']],
                         [('inspect', 'inspect'), ('body', 'showcase')])

    def test_unresolved_named_section_stops_preceding_weapon_images(self):
        rows = self.parse('<h2>M13-黑耀星辰</h2><img src="https://shp.qpic.cn/m13">'
                          '<h2>未知对象-星河</h2><img src="https://shp.qpic.cn/other">')
        self.assertEqual(len(rows[0]['images']), 1)

    def test_original_typo_uses_same_article_evidence_and_keeps_source_label(self):
        rows = self.parse('<p>KRM262-电玩高手闪耀登场</p><h2>KM262-电玩高手</h2>'
                          '<img src="https://shp.qpic.cn/krm">',
                          'https://codm.qq.com/gicp/news/887/18594472.html')
        self.assertEqual(rows[0]['base']['name'], 'KRM-262')
        self.assertEqual(rows[0]['sourceLabel'], 'KM262-电玩高手')

    def test_upstream_failure_preserves_successful_snapshot(self):
        scratch = (importer.ROOT / 'local-only/weapon-skins/codm-tests').resolve()
        self.assertTrue(scratch.is_relative_to(importer.ROOT.resolve()))
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            root = Path(temporary)
            self.assertTrue(root.resolve().is_relative_to(scratch))
            target = root / 'cod-mobile.json'
            before = json.dumps({'skins': [], 'coverage': {}, 'source': {}}).encode()
            target.write_bytes(before)
            with patch.object(importer, 'CACHE', root / 'cache'), patch.object(importer, 'OUT', target), \
                 patch.object(importer.sys, 'argv', ['sync_weapon_codm_cn.py', '--offline']), \
                 patch.object(importer.Fetcher, 'article', side_effect=RuntimeError('upstream unavailable')):
                self.assertEqual(importer.main(), 1)
            self.assertEqual(target.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
