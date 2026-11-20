const CatalogueNavigation = (() => {
  const narrow = matchMedia('(max-width: 760px)');

  function move(id, host) {
    const element = document.getElementById(id);
    if (element.parentElement !== host) host.append(element);
  }

  function sync() {
    const desktop = document.body.classList.contains('archive-view') && !narrow.matches;
    $('#siteDirectory').hidden = !desktop;
    $('#mastheadBrand').hidden = !desktop;
    $('#mastheadCollection').hidden = !desktop;
    $('#catalogueDirectory').hidden = !desktop;
    move('siteNavigation', desktop ? $('#siteDirectory') : $('#siteNavigationHome'));
    move('siteBrand', desktop ? $('#mastheadBrand') : $('#siteBrandHome'));
    move('siteCollection', desktop ? $('#mastheadCollection') : $('#siteCollectionHome'));
  }

  return { sync, bind: () => narrow.addEventListener('change', sync) };
})();
